import * as fflate from 'fflate';
import {
  createBenchmarkOutputWriter,
  deleteBenchmarkOutputs,
  readBenchmarkOutputChunks,
  type BenchmarkOutputWriter,
} from '@/lib/outputStore';
import { Sha256 } from '@/lib/hash';
import type { BenchmarkConfig, BenchmarkResult } from '@/types';

export const LARGE_FILE_STREAMING_THRESHOLD = 64 * 1024 * 1024;

const FILE_CHUNK_SIZE = 1024 * 1024;
const BROTLI_OUTPUT_CHUNK_SIZE = 1024 * 1024;
const MIB = 1024 * 1024;
const LARGE_OUTPUT_POLICY_REASON =
  'Large-file mode keeps only the smallest output per algorithm family to bound IndexedDB usage.';

interface TimingStats {
  avg: number;
  min: number;
  max: number;
}

interface PassStats {
  elapsed: number;
  size: number;
}

interface PushStream {
  push(data: Uint8Array, final?: boolean): void;
}

type ChunkHandler = (chunk: Uint8Array, final: boolean) => void;
type ProgressCallback = (current: number, total: number, name: string) => void;
type NoticeCallback = (message: string) => void;

interface ResultDescriptor {
  algorithm: string;
  family: string;
  extension: string;
  provider: BenchmarkResult['provider'];
  providerLabel: string;
  level?: number;
}

interface LargeTask {
  name: string;
  run(taskIndex: number): Promise<BenchmarkResult | null>;
}

function highResTime(): number {
  return performance.now();
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException('Benchmark cancelled', 'AbortError');
}

function throughputMibPerSecond(bytes: number, milliseconds: number): number {
  if (milliseconds <= 0) return 0;
  return (bytes / MIB) / (milliseconds / 1000);
}

async function runTimedPasses(
  iterations: number,
  runPass: (iteration: number) => Promise<number>,
): Promise<TimingStats> {
  const count = Math.max(1, iterations);
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (let i = 0; i < count; i++) {
    const elapsed = await runPass(i);
    sum += elapsed;
    if (elapsed < min) min = elapsed;
    if (elapsed > max) max = elapsed;
  }

  return { avg: sum / count, min, max };
}

async function forEachFileChunk(
  file: File,
  signal: AbortSignal | undefined,
  visit: (chunk: Uint8Array, final: boolean) => Promise<void>,
): Promise<void> {
  if (file.size === 0) {
    throwIfAborted(signal);
    await visit(new Uint8Array(), true);
    return;
  }

  let offset = 0;
  while (offset < file.size) {
    throwIfAborted(signal);
    const end = Math.min(offset + FILE_CHUNK_SIZE, file.size);
    const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    throwIfAborted(signal);
    await visit(chunk, end === file.size);
    offset = end;
  }
}

async function forEachStoredChunk(
  outputKey: string,
  signal: AbortSignal | undefined,
  visit: (chunk: Uint8Array, final: boolean) => Promise<void>,
): Promise<void> {
  let pending: Uint8Array | null = null;

  for await (const chunk of readBenchmarkOutputChunks(outputKey, signal)) {
    if (pending) await visit(pending, false);
    pending = chunk;
  }

  if (pending) await visit(pending, true);
  else await visit(new Uint8Array(), true);
}

function buildResult(
  descriptor: ResultDescriptor,
  file: File,
  compressedSize: number,
  compression: TimingStats,
  decompression: TimingStats,
  outputKey: string,
  verified: boolean,
  iterations: number,
): BenchmarkResult {
  const compressionRatio = compressedSize > 0 ? file.size / compressedSize : 0;
  const compressionLossPct = file.size > 0
    ? ((file.size - compressedSize) / file.size) * 100
    : 0;

  return {
    algorithm: descriptor.algorithm,
    algorithmFamily: descriptor.family,
    originalSize: file.size,
    compressedSize,
    compressionRatio,
    compressionLossPct,
    compressTime: compression.avg,
    compressTimeMin: compression.min,
    compressTimeMax: compression.max,
    decompressTime: decompression.avg,
    decompressTimeMin: decompression.min,
    decompressTimeMax: decompression.max,
    throughputCompress: throughputMibPerSecond(file.size, compression.avg),
    throughputDecompress: throughputMibPerSecond(file.size, decompression.avg),
    outputKey,
    verified,
    extension: descriptor.extension,
    level: descriptor.level,
    iterations: Math.max(1, iterations),
    provider: descriptor.provider,
    providerLabel: descriptor.providerLabel,
  };
}

// ─── fflate: file slices -> persistent stream -> chunked IndexedDB output ───

async function compressFflatePass(
  file: File,
  createStream: (onData: ChunkHandler) => PushStream,
  signal?: AbortSignal,
  outputWriter?: BenchmarkOutputWriter,
): Promise<PassStats> {
  let elapsed = 0;
  let size = 0;
  const pendingOutput: Uint8Array[] = [];
  const stream = createStream((chunk) => {
    if (chunk.length === 0) return;
    size += chunk.length;
    if (outputWriter) pendingOutput.push(chunk);
  });

  await forEachFileChunk(file, signal, async (chunk, final) => {
    const start = highResTime();
    stream.push(chunk, final);
    elapsed += highResTime() - start;

    if (outputWriter && pendingOutput.length > 0) {
      for (const output of pendingOutput) await outputWriter.write(output);
      pendingOutput.length = 0;
    }
  });

  return { elapsed, size };
}

async function decompressFflatePass(
  outputKey: string,
  createStream: (onData: ChunkHandler) => PushStream,
  signal?: AbortSignal,
  hasher?: Sha256,
): Promise<PassStats> {
  let elapsed = 0;
  let size = 0;
  const stream = createStream((chunk) => {
    if (chunk.length === 0) return;
    size += chunk.length;
    hasher?.update(chunk);
  });

  await forEachStoredChunk(outputKey, signal, async (chunk, final) => {
    const start = highResTime();
    stream.push(chunk, final);
    elapsed += highResTime() - start;
  });

  return { elapsed, size };
}

async function benchmarkFflateLarge(
  file: File,
  sourceHash: string,
  iterations: number,
  descriptor: ResultDescriptor,
  createCompressor: (onData: ChunkHandler) => PushStream,
  createDecompressor: (onData: ChunkHandler) => PushStream,
  runId: string,
  taskIndex: number,
  signal?: AbortSignal,
): Promise<BenchmarkResult> {
  const outputWriter = createBenchmarkOutputWriter(runId, taskIndex);

  try {
    let compressedSize = 0;
    const compression = await runTimedPasses(iterations, async (iteration) => {
      throwIfAborted(signal);
      const materialize = iteration === Math.max(1, iterations) - 1;
      const pass = await compressFflatePass(
        file,
        createCompressor,
        signal,
        materialize ? outputWriter : undefined,
      );
      if (materialize) compressedSize = pass.size;
      return pass.elapsed;
    });

    const outputKey = await outputWriter.close();
    compressedSize = outputWriter.size || compressedSize;

    const decompression = await runTimedPasses(iterations, async () => {
      throwIfAborted(signal);
      return (await decompressFflatePass(outputKey, createDecompressor, signal)).elapsed;
    });

    const verifier = new Sha256();
    const verifyPass = await decompressFflatePass(outputKey, createDecompressor, signal, verifier);
    const verified = verifyPass.size === file.size && verifier.digestHex() === sourceHash;

    return buildResult(
      descriptor,
      file,
      compressedSize,
      compression,
      decompression,
      outputKey,
      verified,
      iterations,
    );
  } catch (error) {
    await outputWriter.abort().catch(() => undefined);
    throw error;
  }
}

// ─── Native CompressionStream / DecompressionStream ───

async function drainReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
  outputWriter?: BenchmarkOutputWriter,
  hasher?: Sha256,
): Promise<number> {
  let size = 0;
  while (true) {
    throwIfAborted(signal);
    const { done, value } = await reader.read();
    if (done) break;
    if (value.length === 0) continue;
    size += value.length;
    hasher?.update(value);
    if (outputWriter) await outputWriter.write(value);
  }
  return size;
}

async function compressNativePass(
  file: File,
  format: string,
  signal?: AbortSignal,
  outputWriter?: BenchmarkOutputWriter,
): Promise<PassStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = new CompressionStream(format as any);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const drain = drainReader(reader, signal, outputWriter);
  let elapsed = 0;

  await forEachFileChunk(file, signal, async (chunk) => {
    const start = highResTime();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await writer.write(chunk as any);
    elapsed += highResTime() - start;
  });

  const closeStart = highResTime();
  await writer.close();
  elapsed += highResTime() - closeStart;
  const size = await drain;

  return { elapsed, size };
}

async function decompressNativePass(
  outputKey: string,
  format: string,
  signal?: AbortSignal,
  hasher?: Sha256,
): Promise<PassStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = new DecompressionStream(format as any);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const drain = drainReader(reader, signal, undefined, hasher);
  let elapsed = 0;

  await forEachStoredChunk(outputKey, signal, async (chunk) => {
    const start = highResTime();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await writer.write(chunk as any);
    elapsed += highResTime() - start;
  });

  const closeStart = highResTime();
  await writer.close();
  elapsed += highResTime() - closeStart;
  const size = await drain;

  return { elapsed, size };
}

async function benchmarkNativeLarge(
  file: File,
  sourceHash: string,
  iterations: number,
  descriptor: ResultDescriptor,
  format: string,
  runId: string,
  taskIndex: number,
  signal?: AbortSignal,
): Promise<BenchmarkResult | null> {
  const outputWriter = createBenchmarkOutputWriter(runId, taskIndex);

  try {
    const compression = await runTimedPasses(iterations, async () => {
      throwIfAborted(signal);
      return (await compressNativePass(file, format, signal)).elapsed;
    });

    // Keep IndexedDB write latency out of the timing numbers. Native streams can
    // backpressure on their output reader, so materialization is a separate pass.
    const materialized = await compressNativePass(file, format, signal, outputWriter);
    const outputKey = await outputWriter.close();
    const compressedSize = outputWriter.size || materialized.size;

    const decompression = await runTimedPasses(iterations, async () => {
      throwIfAborted(signal);
      return (await decompressNativePass(outputKey, format, signal)).elapsed;
    });

    const verifier = new Sha256();
    const verifyPass = await decompressNativePass(outputKey, format, signal, verifier);
    const verified = verifyPass.size === file.size && verifier.digestHex() === sourceHash;

    return buildResult(
      descriptor,
      file,
      compressedSize,
      compression,
      decompression,
      outputKey,
      verified,
      iterations,
    );
  } catch (error) {
    await outputWriter.abort().catch(() => undefined);
    if (signal?.aborted) throw error;
    return null;
  }
}

// ─── brotli-wasm streaming API ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let brotliWasmPromise: Promise<any | null> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadBrotliWasm(): Promise<any | null> {
  if (!brotliWasmPromise) {
    brotliWasmPromise = (async () => {
      try {
        const mod = await import('brotli-wasm');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let wasm: any = mod.default || mod;
        if (typeof wasm === 'function') wasm = await wasm();
        return wasm;
      } catch {
        return null;
      }
    })();
  }
  return brotliWasmPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function compressBrotliPass(
  wasm: any,
  file: File,
  quality: number,
  signal?: AbortSignal,
  outputWriter?: BenchmarkOutputWriter,
): Promise<PassStats> {
  const stream = new wasm.CompressStream(quality);
  let elapsed = 0;
  let size = 0;

  const consumeResult = async (result: any) => {
    if (result.buf?.length) {
      size += result.buf.length;
      if (outputWriter) await outputWriter.write(result.buf);
    }
  };

  try {
    await forEachFileChunk(file, signal, async (sourceChunk) => {
      let input = sourceChunk;
      while (input.length > 0) {
        throwIfAborted(signal);
        const start = highResTime();
        const result = stream.compress(input, BROTLI_OUTPUT_CHUNK_SIZE);
        elapsed += highResTime() - start;
        await consumeResult(result);

        const consumed = result.input_offset ?? 0;
        if (consumed < 0 || consumed > input.length) {
          throw new Error('Invalid Brotli compression input offset');
        }
        input = input.subarray(consumed);

        if (result.code === wasm.BrotliStreamResultCode.NeedsMoreOutput) {
          if (consumed === 0 && !result.buf?.length) {
            throw new Error('Brotli compression made no progress');
          }
          continue;
        }
        if (result.code === wasm.BrotliStreamResultCode.NeedsMoreInput) break;
        if (result.code === wasm.BrotliStreamResultCode.ResultSuccess) break;
        throw new Error(`Brotli compression failed with code ${result.code}`);
      }
    });

    while (true) {
      throwIfAborted(signal);
      const start = highResTime();
      const result = stream.compress(undefined, BROTLI_OUTPUT_CHUNK_SIZE);
      elapsed += highResTime() - start;
      await consumeResult(result);

      if (result.code === wasm.BrotliStreamResultCode.NeedsMoreOutput) continue;
      if (result.code === wasm.BrotliStreamResultCode.ResultSuccess) break;
      throw new Error(`Brotli compression flush failed with code ${result.code}`);
    }

    return { elapsed, size };
  } finally {
    stream.free?.();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function decompressBrotliPass(
  wasm: any,
  outputKey: string,
  signal?: AbortSignal,
  hasher?: Sha256,
): Promise<PassStats> {
  const stream = new wasm.DecompressStream();
  let elapsed = 0;
  let size = 0;
  let complete = false;

  try {
    for await (const sourceChunk of readBenchmarkOutputChunks(outputKey, signal)) {
      let input = sourceChunk;
      while (input.length > 0) {
        throwIfAborted(signal);
        const start = highResTime();
        const result = stream.decompress(input, FILE_CHUNK_SIZE);
        elapsed += highResTime() - start;

        if (result.buf?.length) {
          size += result.buf.length;
          hasher?.update(result.buf);
        }

        const consumed = result.input_offset ?? 0;
        if (consumed < 0 || consumed > input.length) {
          throw new Error('Invalid Brotli decompression input offset');
        }
        input = input.subarray(consumed);

        if (result.code === wasm.BrotliStreamResultCode.NeedsMoreOutput) {
          if (consumed === 0 && !result.buf?.length) {
            throw new Error('Brotli decompression made no progress');
          }
          continue;
        }
        if (result.code === wasm.BrotliStreamResultCode.NeedsMoreInput) break;
        if (result.code === wasm.BrotliStreamResultCode.ResultSuccess) {
          complete = true;
          break;
        }
        throw new Error(`Brotli decompression failed with code ${result.code}`);
      }
      if (complete) break;
    }

    if (!complete) throw new Error('Brotli decompression ended before stream completion');
    return { elapsed, size };
  } finally {
    stream.free?.();
  }
}

async function benchmarkBrotliLarge(
  file: File,
  sourceHash: string,
  quality: number,
  iterations: number,
  runId: string,
  taskIndex: number,
  signal?: AbortSignal,
): Promise<BenchmarkResult | null> {
  const wasm = await loadBrotliWasm();
  if (!wasm || typeof wasm.CompressStream !== 'function' || typeof wasm.DecompressStream !== 'function') {
    return null;
  }

  const outputWriter = createBenchmarkOutputWriter(runId, taskIndex);
  const descriptor: ResultDescriptor = {
    algorithm: `Brotli Q${quality} [WASM]`,
    family: 'brotli',
    extension: '.br',
    provider: 'brotli-wasm',
    providerLabel: 'brotli-wasm (WASM)',
    level: quality,
  };

  try {
    let compressedSize = 0;
    const compression = await runTimedPasses(iterations, async (iteration) => {
      throwIfAborted(signal);
      const materialize = iteration === Math.max(1, iterations) - 1;
      const pass = await compressBrotliPass(
        wasm,
        file,
        quality,
        signal,
        materialize ? outputWriter : undefined,
      );
      if (materialize) compressedSize = pass.size;
      return pass.elapsed;
    });

    const outputKey = await outputWriter.close();
    compressedSize = outputWriter.size || compressedSize;

    const decompression = await runTimedPasses(iterations, async () => {
      throwIfAborted(signal);
      return (await decompressBrotliPass(wasm, outputKey, signal)).elapsed;
    });

    const verifier = new Sha256();
    const verifyPass = await decompressBrotliPass(wasm, outputKey, signal, verifier);
    const verified = verifyPass.size === file.size && verifier.digestHex() === sourceHash;

    return buildResult(
      descriptor,
      file,
      compressedSize,
      compression,
      decompression,
      outputKey,
      verified,
      iterations,
    );
  } catch (error) {
    await outputWriter.abort().catch(() => undefined);
    if (signal?.aborted) throw error;
    return null;
  }
}

function runId(): string {
  return `stream_${Date.now()}_${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

export async function runLargeFileBenchmarks(
  file: File,
  sourceHash: string,
  config: BenchmarkConfig,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
  onNotice?: NoticeCallback,
): Promise<BenchmarkResult[]> {
  const id = runId();
  const iterations = Math.max(1, config.iterations);
  const tasks: LargeTask[] = [];
  let skippedZstdCodec = false;

  onNotice?.(
    `Large-file streaming mode: ${FILE_CHUNK_SIZE / MIB} MiB file slices, persistent codec state, and chunked IndexedDB output spill.`,
  );
  onNotice?.(
    'Large-file timing excludes file-read and IndexedDB spill latency so codec throughput stays comparable to the in-memory benchmark.',
  );
  onNotice?.(
    'To bound browser storage, large-file mode keeps downloadable output only for the smallest result in each algorithm family.',
  );

  for (const algo of config.algorithms) {
    if (!algo.enabled) continue;

    if (algo.id === 'gzip-js') {
      for (const level of algo.levels) {
        const typedLevel = level as fflate.DeflateOptions['level'];
        tasks.push({
          name: `Gzip L${level} [JS]`,
          run: taskIndex => benchmarkFflateLarge(
            file,
            sourceHash,
            iterations,
            {
              algorithm: `Gzip L${level} [JS]`, family: 'gzip', extension: '.gz',
              provider: 'fflate', providerLabel: 'fflate (JS)', level,
            },
            onData => new fflate.Gzip({ level: typedLevel }, onData),
            onData => new fflate.Gunzip(onData),
            id,
            taskIndex,
            signal,
          ),
        });
      }
    } else if (algo.id === 'deflate-js') {
      for (const level of algo.levels) {
        const typedLevel = level as fflate.DeflateOptions['level'];
        tasks.push({
          name: `Deflate L${level} [JS]`,
          run: taskIndex => benchmarkFflateLarge(
            file,
            sourceHash,
            iterations,
            {
              algorithm: `Deflate L${level} [JS]`, family: 'deflate', extension: '.deflate',
              provider: 'fflate', providerLabel: 'fflate (JS)', level,
            },
            onData => new fflate.Deflate({ level: typedLevel }, onData),
            onData => new fflate.Inflate(onData),
            id,
            taskIndex,
            signal,
          ),
        });
      }
    } else if (algo.id === 'zlib-js') {
      for (const level of algo.levels) {
        const typedLevel = level as fflate.DeflateOptions['level'];
        tasks.push({
          name: `Zlib L${level} [JS]`,
          run: taskIndex => benchmarkFflateLarge(
            file,
            sourceHash,
            iterations,
            {
              algorithm: `Zlib L${level} [JS]`, family: 'zlib', extension: '.zz',
              provider: 'fflate', providerLabel: 'fflate (JS)', level,
            },
            onData => new fflate.Zlib({ level: typedLevel }, onData),
            onData => new fflate.Unzlib(onData),
            id,
            taskIndex,
            signal,
          ),
        });
      }
    } else if (algo.id === 'gzip-native') {
      tasks.push({
        name: 'Gzip [Native]',
        run: taskIndex => benchmarkNativeLarge(
          file,
          sourceHash,
          iterations,
          { algorithm: 'Gzip [Native]', family: 'gzip', extension: '.gz', provider: 'native', providerLabel: 'Native Browser' },
          'gzip',
          id,
          taskIndex,
          signal,
        ),
      });
    } else if (algo.id === 'deflate-native') {
      tasks.push({
        name: 'Deflate [Native]',
        run: taskIndex => benchmarkNativeLarge(
          file,
          sourceHash,
          iterations,
          { algorithm: 'Deflate [Native]', family: 'deflate', extension: '.deflate', provider: 'native', providerLabel: 'Native Browser' },
          'deflate',
          id,
          taskIndex,
          signal,
        ),
      });
    } else if (algo.id === 'deflate-raw-native') {
      tasks.push({
        name: 'Deflate-Raw [Native]',
        run: taskIndex => benchmarkNativeLarge(
          file,
          sourceHash,
          iterations,
          { algorithm: 'Deflate-Raw [Native]', family: 'deflate-raw', extension: '.deflate', provider: 'native', providerLabel: 'Native Browser' },
          'deflate-raw',
          id,
          taskIndex,
          signal,
        ),
      });
    } else if (algo.id === 'brotli-native') {
      tasks.push({
        name: 'Brotli [Native]',
        run: taskIndex => benchmarkNativeLarge(
          file,
          sourceHash,
          iterations,
          { algorithm: 'Brotli [Native]', family: 'brotli', extension: '.br', provider: 'native', providerLabel: 'Native Browser' },
          'brotli',
          id,
          taskIndex,
          signal,
        ),
      });
    } else if (algo.id === 'brotli-wasm') {
      for (const quality of algo.levels) {
        tasks.push({
          name: `Brotli Q${quality} [WASM]`,
          run: taskIndex => benchmarkBrotliLarge(
            file,
            sourceHash,
            quality,
            iterations,
            id,
            taskIndex,
            signal,
          ),
        });
      }
    } else if (algo.id === 'zstd-native') {
      tasks.push({
        name: 'Zstandard [Native]',
        run: taskIndex => benchmarkNativeLarge(
          file,
          sourceHash,
          iterations,
          { algorithm: 'Zstandard [Native]', family: 'zstd', extension: '.zst', provider: 'native', providerLabel: 'Native Browser' },
          'zstd',
          id,
          taskIndex,
          signal,
        ),
      });
    } else if (algo.id === 'zstd-wasm') {
      skippedZstdCodec = true;
    }
  }

  if (skippedZstdCodec) {
    onNotice?.(
      'zstd-codec WASM is skipped in large-file mode: its public Streaming API still accumulates the final output buffer. Native Zstd remains enabled when the browser supports it.',
    );
  }

  const results: BenchmarkResult[] = [];
  const bestOutputByFamily = new Map<string, { resultIndex: number; size: number; key: string }>();

  try {
    for (let i = 0; i < tasks.length; i++) {
      throwIfAborted(signal);
      onProgress(i, tasks.length, tasks[i].name);

      let result: BenchmarkResult | null;
      try {
        result = await tasks[i].run(i);
      } catch (error) {
        if (signal?.aborted) throw error;
        const message = error instanceof Error ? error.message : 'unknown error';
        console.warn(`Large-file benchmark failed: ${tasks[i].name}`, error);
        onNotice?.(`${tasks[i].name} was skipped after an error: ${message}`);
        continue;
      }
      if (!result) continue;

      const resultIndex = results.length;
      const prior = bestOutputByFamily.get(result.algorithmFamily);

      if (!result.outputKey) {
        result.outputUnavailableReason = 'Compressed output could not be retained in browser storage.';
      } else if (!prior || result.compressedSize < prior.size) {
        if (prior) {
          await deleteBenchmarkOutputs([prior.key]);
          const priorResult = results[prior.resultIndex];
          priorResult.outputKey = null;
          priorResult.outputUnavailableReason = LARGE_OUTPUT_POLICY_REASON;
        }
        bestOutputByFamily.set(result.algorithmFamily, {
          resultIndex,
          size: result.compressedSize,
          key: result.outputKey,
        });
      } else {
        await deleteBenchmarkOutputs([result.outputKey]);
        result.outputKey = null;
        result.outputUnavailableReason = LARGE_OUTPUT_POLICY_REASON;
      }

      results.push(result);
    }
  } catch (error) {
    await deleteBenchmarkOutputs(results.map(result => result.outputKey)).catch(() => undefined);
    throw error;
  }

  onProgress(tasks.length, tasks.length, 'Complete');
  return results;
}
