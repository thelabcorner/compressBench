import * as fflate from 'fflate';
import { storeBenchmarkOutput } from '@/lib/outputStore';
import type { BenchmarkResult, AlgorithmConfig, BenchmarkConfig } from '@/types';

const INPUT_CHUNK_SIZE = 1024 * 1024;
const BROTLI_OUTPUT_CHUNK_SIZE = 256 * 1024;
const MIB = 1024 * 1024;

type BenchmarkOutput = Blob | Uint8Array;
type RawBenchmarkResult = BenchmarkResult & { compressedData: BenchmarkOutput };

interface TimingStats {
  avg: number;
  min: number;
  max: number;
}

interface PushStream {
  push(data: Uint8Array, final?: boolean): void;
}

type ChunkHandler = (chunk: Uint8Array, final: boolean) => void;

function highResTime(): number {
  return performance.now();
}

function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function* chunkViews(data: Uint8Array, chunkSize = INPUT_CHUNK_SIZE): Generator<Uint8Array> {
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    yield data.subarray(offset, Math.min(offset + chunkSize, data.length));
  }
}

function chunksLength(chunks: readonly Uint8Array[]): number {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  return total;
}

function chunksEqual(data: Uint8Array, chunks: readonly Uint8Array[]): boolean {
  let offset = 0;
  for (const chunk of chunks) {
    if (offset + chunk.length > data.length) return false;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] !== data[offset + i]) return false;
    }
    offset += chunk.length;
  }
  return offset === data.length;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function exactArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = data.buffer;
  if (
    buffer instanceof ArrayBuffer &&
    data.byteOffset === 0 &&
    data.byteLength === buffer.byteLength
  ) {
    return buffer;
  }
  return Uint8Array.from(data).buffer;
}

function chunksToBlob(chunks: readonly Uint8Array[]): Blob {
  return new Blob(chunks.map(exactArrayBuffer), { type: 'application/octet-stream' });
}

function throughputMibPerSecond(bytes: number, milliseconds: number): number {
  return (bytes / MIB) / (milliseconds / 1000);
}

async function runTimedWithYield(fn: () => void, iterations: number): Promise<TimingStats> {
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (let i = 0; i < iterations; i++) {
    if (i > 0 && i % 3 === 0) await yieldToUI();
    const start = highResTime();
    fn();
    const elapsed = highResTime() - start;
    sum += elapsed;
    if (elapsed < min) min = elapsed;
    if (elapsed > max) max = elapsed;
  }

  return { avg: sum / iterations, min, max };
}

async function runTimedAsync(fn: () => Promise<void>, iterations: number): Promise<TimingStats> {
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (let i = 0; i < iterations; i++) {
    if (i > 0 && i % 2 === 0) await yieldToUI();
    const start = highResTime();
    await fn();
    const elapsed = highResTime() - start;
    sum += elapsed;
    if (elapsed < min) min = elapsed;
    if (elapsed > max) max = elapsed;
  }

  return { avg: sum / iterations, min, max };
}

// ─── Brotli WASM loader ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let brotliWasm: any = null;
let brotliWasmLoaded = false;

async function loadBrotliWasm() {
  if (brotliWasmLoaded) return brotliWasm;
  try {
    const mod = await import('brotli-wasm');
    brotliWasm = mod.default || mod;
    if (typeof brotliWasm === 'function') {
      brotliWasm = await brotliWasm();
    }
    brotliWasmLoaded = true;
    return brotliWasm;
  } catch {
    brotliWasmLoaded = true;
    return null;
  }
}

// ─── Zstd codec loader ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let zstdCodecInstance: any = null;
let zstdCodecLoaded = false;

async function loadZstdCodec() {
  if (zstdCodecLoaded) return zstdCodecInstance;
  try {
    const ZstdCodec = (await import('zstd-codec')).ZstdCodec;
    zstdCodecInstance = await new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ZstdCodec.run((zstd: any) => {
        try {
          resolve(new zstd.Streaming());
        } catch (e) {
          reject(e);
        }
      });
    });
    zstdCodecLoaded = true;
    return zstdCodecInstance;
  } catch {
    zstdCodecLoaded = true;
    return null;
  }
}

// ─── Feature detection ───

async function isFormatSupported(format: string): Promise<boolean> {
  try {
    // Construction is sufficient to detect unsupported CompressionStream formats.
    // Avoid doing actual compression work during application startup.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new CompressionStream(format as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new DecompressionStream(format as any);
    return true;
  } catch {
    return false;
  }
}

export async function checkBrotliSupport(): Promise<boolean> {
  return isFormatSupported('brotli');
}

export async function checkZstdSupport(): Promise<boolean> {
  return isFormatSupported('zstd');
}

export async function checkBrotliWasmSupport(): Promise<boolean> {
  const wasm = await loadBrotliWasm();
  return wasm !== null;
}

export async function checkZstdCodecSupport(): Promise<boolean> {
  const codec = await loadZstdCodec();
  return codec !== null;
}

// ─── fflate streaming benchmarks ───

function collectFflateCompressed(
  data: Uint8Array,
  createStream: (onData: ChunkHandler) => PushStream,
): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  const stream = createStream((chunk) => {
    if (chunk.length > 0) chunks.push(chunk);
  });

  if (data.length === 0) {
    stream.push(data, true);
    return chunks;
  }

  let offset = 0;
  for (const chunk of chunkViews(data)) {
    offset += chunk.length;
    stream.push(chunk, offset === data.length);
  }
  return chunks;
}

function collectFflateDecompressed(
  compressed: readonly Uint8Array[],
  createStream: (onData: ChunkHandler) => PushStream,
): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  const stream = createStream((chunk) => {
    if (chunk.length > 0) chunks.push(chunk);
  });

  for (let i = 0; i < compressed.length; i++) {
    stream.push(compressed[i], i === compressed.length - 1);
  }
  return chunks;
}

async function benchmarkFflate(
  data: Uint8Array,
  level: number,
  iterations: number,
  label: string,
  family: string,
  extension: string,
  createCompressor: (onData: ChunkHandler) => PushStream,
  createDecompressor: (onData: ChunkHandler) => PushStream,
): Promise<RawBenchmarkResult> {
  let compressedChunks: Uint8Array[] = [];
  const compTiming = await runTimedWithYield(() => {
    compressedChunks = collectFflateCompressed(data, createCompressor);
  }, iterations);

  let decompressedChunks: Uint8Array[] = [];
  const decompTiming = await runTimedWithYield(() => {
    decompressedChunks = collectFflateDecompressed(compressedChunks, createDecompressor);
  }, iterations);

  const originalSize = data.length;
  const compressedSize = chunksLength(compressedChunks);

  return {
    algorithm: label,
    algorithmFamily: family,
    originalSize,
    compressedSize,
    compressionRatio: originalSize / compressedSize,
    compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
    compressTime: compTiming.avg,
    compressTimeMin: compTiming.min,
    compressTimeMax: compTiming.max,
    decompressTime: decompTiming.avg,
    decompressTimeMin: decompTiming.min,
    decompressTimeMax: decompTiming.max,
    throughputCompress: throughputMibPerSecond(originalSize, compTiming.avg),
    throughputDecompress: throughputMibPerSecond(originalSize, decompTiming.avg),
    outputKey: null,
    compressedData: chunksToBlob(compressedChunks),
    verified: chunksEqual(data, decompressedChunks),
    extension,
    level,
    iterations,
    provider: 'fflate',
    providerLabel: 'fflate (JS)',
  };
}

async function benchmarkFflateGzip(data: Uint8Array, level: number, iterations: number): Promise<RawBenchmarkResult> {
  const typedLevel = level as fflate.DeflateOptions['level'];
  return benchmarkFflate(
    data,
    level,
    iterations,
    `Gzip L${level} [JS]`,
    'gzip',
    '.gz',
    onData => new fflate.Gzip({ level: typedLevel }, onData),
    onData => new fflate.Gunzip(onData),
  );
}

async function benchmarkFflateDeflate(data: Uint8Array, level: number, iterations: number): Promise<RawBenchmarkResult> {
  const typedLevel = level as fflate.DeflateOptions['level'];
  return benchmarkFflate(
    data,
    level,
    iterations,
    `Deflate L${level} [JS]`,
    'deflate',
    '.deflate',
    onData => new fflate.Deflate({ level: typedLevel }, onData),
    onData => new fflate.Inflate(onData),
  );
}

async function benchmarkFflateZlib(data: Uint8Array, level: number, iterations: number): Promise<RawBenchmarkResult> {
  const typedLevel = level as fflate.DeflateOptions['level'];
  return benchmarkFflate(
    data,
    level,
    iterations,
    `Zlib L${level} [JS]`,
    'zlib',
    '.zz',
    onData => new fflate.Zlib({ level: typedLevel }, onData),
    onData => new fflate.Unzlib(onData),
  );
}

// ─── CompressionStream-based native benchmarks ───

async function compressNative(data: Uint8Array, format: string): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs = new CompressionStream(format as any);
  const writer = cs.writable.getWriter();
  const output = new Response(cs.readable).blob();

  for (const chunk of chunkViews(data)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await writer.write(chunk as any);
  }
  await writer.close();
  return output;
}

async function decompressNative(data: Blob, format: string): Promise<Uint8Array[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = new DecompressionStream(format as any);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];

  const readAll = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();

  const source = data.stream().getReader();
  while (true) {
    const { done, value } = await source.read();
    if (done) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await writer.write(value as any);
  }
  await writer.close();
  await readAll;
  return chunks;
}

async function benchmarkNative(
  data: Uint8Array,
  format: string,
  label: string,
  ext: string,
  family: string,
  iterations: number,
): Promise<RawBenchmarkResult | null> {
  try {
    let compressed = new Blob();
    const compTiming = await runTimedAsync(async () => {
      compressed = await compressNative(data, format);
    }, iterations);

    await yieldToUI();

    let decompressedChunks: Uint8Array[] = [];
    const decompTiming = await runTimedAsync(async () => {
      decompressedChunks = await decompressNative(compressed, format);
    }, iterations);

    const originalSize = data.length;
    const compressedSize = compressed.size;

    return {
      algorithm: label,
      algorithmFamily: family,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize,
      compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
      compressTime: compTiming.avg,
      compressTimeMin: compTiming.min,
      compressTimeMax: compTiming.max,
      decompressTime: decompTiming.avg,
      decompressTimeMin: decompTiming.min,
      decompressTimeMax: decompTiming.max,
      throughputCompress: throughputMibPerSecond(originalSize, compTiming.avg),
      throughputDecompress: throughputMibPerSecond(originalSize, decompTiming.avg),
      outputKey: null,
      compressedData: compressed,
      verified: chunksEqual(data, decompressedChunks),
      extension: ext,
      iterations,
      provider: 'native',
      providerLabel: 'Native Browser',
    };
  } catch {
    return null;
  }
}

// ─── Brotli WASM streaming benchmark ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectBrotliCompressed(wasm: any, data: Uint8Array, quality: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  const stream = new wasm.CompressStream(quality);

  try {
    for (const sourceChunk of chunkViews(data)) {
      let input = sourceChunk;
      while (input.length > 0) {
        const result = stream.compress(input, BROTLI_OUTPUT_CHUNK_SIZE);
        if (result.buf?.length) chunks.push(result.buf);

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
    }

    while (true) {
      const result = stream.compress(undefined, BROTLI_OUTPUT_CHUNK_SIZE);
      if (result.buf?.length) chunks.push(result.buf);
      if (result.code === wasm.BrotliStreamResultCode.NeedsMoreOutput) continue;
      if (result.code === wasm.BrotliStreamResultCode.ResultSuccess) break;
      throw new Error(`Brotli compression flush failed with code ${result.code}`);
    }

    return chunks;
  } finally {
    stream.free?.();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectBrotliDecompressed(wasm: any, compressed: readonly Uint8Array[]): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  const stream = new wasm.DecompressStream();
  let complete = false;

  try {
    for (const sourceChunk of compressed) {
      let input = sourceChunk;
      while (input.length > 0) {
        const result = stream.decompress(input, INPUT_CHUNK_SIZE);
        if (result.buf?.length) chunks.push(result.buf);

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
    return chunks;
  } finally {
    stream.free?.();
  }
}

async function benchmarkBrotliWasm(
  data: Uint8Array,
  quality: number,
  iterations: number,
): Promise<RawBenchmarkResult | null> {
  const wasm = await loadBrotliWasm();
  if (!wasm) return null;

  try {
    if (typeof wasm.CompressStream === 'function' && typeof wasm.DecompressStream === 'function') {
      let compressedChunks: Uint8Array[] = [];
      const compTiming = await runTimedWithYield(() => {
        compressedChunks = collectBrotliCompressed(wasm, data, quality);
      }, iterations);

      await yieldToUI();

      let decompressedChunks: Uint8Array[] = [];
      const decompTiming = await runTimedWithYield(() => {
        decompressedChunks = collectBrotliDecompressed(wasm, compressedChunks);
      }, iterations);

      const originalSize = data.length;
      const compressedSize = chunksLength(compressedChunks);

      return {
        algorithm: `Brotli Q${quality} [WASM]`,
        algorithmFamily: 'brotli',
        originalSize,
        compressedSize,
        compressionRatio: originalSize / compressedSize,
        compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
        compressTime: compTiming.avg,
        compressTimeMin: compTiming.min,
        compressTimeMax: compTiming.max,
        decompressTime: decompTiming.avg,
        decompressTimeMin: decompTiming.min,
        decompressTimeMax: decompTiming.max,
        throughputCompress: throughputMibPerSecond(originalSize, compTiming.avg),
        throughputDecompress: throughputMibPerSecond(originalSize, decompTiming.avg),
        outputKey: null,
        compressedData: chunksToBlob(compressedChunks),
        verified: chunksEqual(data, decompressedChunks),
        extension: '.br',
        level: quality,
        iterations,
        provider: 'brotli-wasm',
        providerLabel: 'brotli-wasm (WASM)',
      };
    }

    let compressed!: Uint8Array;
    const compTiming = await runTimedWithYield(() => {
      compressed = wasm.compress(data, { quality });
    }, iterations);

    let decompressed!: Uint8Array;
    const decompTiming = await runTimedWithYield(() => {
      decompressed = wasm.decompress(compressed);
    }, iterations);

    const originalSize = data.length;
    const compressedSize = compressed.length;

    return {
      algorithm: `Brotli Q${quality} [WASM]`,
      algorithmFamily: 'brotli',
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize,
      compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
      compressTime: compTiming.avg,
      compressTimeMin: compTiming.min,
      compressTimeMax: compTiming.max,
      decompressTime: decompTiming.avg,
      decompressTimeMin: decompTiming.min,
      decompressTimeMax: decompTiming.max,
      throughputCompress: throughputMibPerSecond(originalSize, compTiming.avg),
      throughputDecompress: throughputMibPerSecond(originalSize, decompTiming.avg),
      outputKey: null,
      compressedData: compressed,
      verified: arraysEqual(data, decompressed),
      extension: '.br',
      level: quality,
      iterations,
      provider: 'brotli-wasm',
      providerLabel: 'brotli-wasm (WASM)',
    };
  } catch {
    return null;
  }
}

// ─── Zstd codec streaming benchmark ───

async function benchmarkZstdCodec(
  data: Uint8Array,
  level: number,
  iterations: number,
): Promise<RawBenchmarkResult | null> {
  const codec = await loadZstdCodec();
  if (!codec) return null;

  try {
    let compressed!: Uint8Array;
    const compTiming = await runTimedWithYield(() => {
      compressed = codec.compressChunks(chunkViews(data), undefined, level);
      if (!compressed) throw new Error('Zstd compression failed');
    }, iterations);

    await yieldToUI();

    let decompressed!: Uint8Array;
    const decompTiming = await runTimedWithYield(() => {
      decompressed = codec.decompressChunks(chunkViews(compressed), data.length);
      if (!decompressed) throw new Error('Zstd decompression failed');
    }, iterations);

    const originalSize = data.length;
    const compressedSize = compressed.length;

    return {
      algorithm: `Zstd L${level} [WASM]`,
      algorithmFamily: 'zstd',
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize,
      compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
      compressTime: compTiming.avg,
      compressTimeMin: compTiming.min,
      compressTimeMax: compTiming.max,
      decompressTime: decompTiming.avg,
      decompressTimeMin: decompTiming.min,
      decompressTimeMax: decompTiming.max,
      throughputCompress: throughputMibPerSecond(originalSize, compTiming.avg),
      throughputDecompress: throughputMibPerSecond(originalSize, decompTiming.avg),
      outputKey: null,
      compressedData: compressed,
      verified: arraysEqual(data, decompressed),
      extension: '.zst',
      level,
      iterations,
      provider: 'zstd-codec',
      providerLabel: 'zstd-codec (WASM)',
    };
  } catch {
    return null;
  }
}

// ─── Default algorithm configurations ───

export async function getDefaultAlgorithms(): Promise<AlgorithmConfig[]> {
  const [nativeBrotli, nativeZstd] = await Promise.all([
    checkBrotliSupport(),
    checkZstdSupport(),
  ]);

  // These libraries are bundled dependencies. Deferring their actual import and
  // WASM initialization until the first matching benchmark removes a large chunk
  // of startup work while preserving availability on WebAssembly-capable browsers.
  const wasmSupported = typeof WebAssembly !== 'undefined';

  const deflateRange = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const brotliRange = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const zstdRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  return [
    {
      id: 'gzip-js', name: 'Gzip [JS]', family: 'gzip', enabled: true,
      levels: [1, 6, 9], availableLevels: deflateRange, supportsLevels: true,
      extension: '.gz', provider: 'fflate', nativeSupported: true,
    },
    {
      id: 'deflate-js', name: 'Deflate [JS]', family: 'deflate', enabled: true,
      levels: [1, 6, 9], availableLevels: deflateRange, supportsLevels: true,
      extension: '.deflate', provider: 'fflate', nativeSupported: true,
    },
    {
      id: 'zlib-js', name: 'Zlib [JS]', family: 'zlib', enabled: true,
      levels: [1, 6, 9], availableLevels: deflateRange, supportsLevels: true,
      extension: '.zz', provider: 'fflate', nativeSupported: true,
    },
    {
      id: 'gzip-native', name: 'Gzip [Native]', family: 'gzip', enabled: true,
      levels: [], availableLevels: [], supportsLevels: false,
      extension: '.gz', provider: 'native', nativeSupported: true,
    },
    {
      id: 'deflate-native', name: 'Deflate [Native]', family: 'deflate', enabled: true,
      levels: [], availableLevels: [], supportsLevels: false,
      extension: '.deflate', provider: 'native', nativeSupported: true,
    },
    {
      id: 'deflate-raw-native', name: 'Deflate-Raw [Native]', family: 'deflate-raw', enabled: true,
      levels: [], availableLevels: [], supportsLevels: false,
      extension: '.deflate', provider: 'native', nativeSupported: true,
    },
    {
      id: 'brotli-native', name: 'Brotli [Native]', family: 'brotli', enabled: nativeBrotli,
      levels: [], availableLevels: [], supportsLevels: false,
      extension: '.br', provider: 'native', nativeSupported: nativeBrotli,
    },
    {
      id: 'brotli-wasm', name: 'Brotli [WASM]', family: 'brotli', enabled: wasmSupported,
      levels: [1, 6, 11], availableLevels: brotliRange, supportsLevels: true,
      extension: '.br', provider: 'brotli-wasm', nativeSupported: wasmSupported,
    },
    {
      id: 'zstd-native', name: 'Zstandard [Native]', family: 'zstd', enabled: nativeZstd,
      levels: [], availableLevels: [], supportsLevels: false,
      extension: '.zst', provider: 'native', nativeSupported: nativeZstd,
    },
    {
      id: 'zstd-wasm', name: 'Zstandard [WASM]', family: 'zstd', enabled: wasmSupported,
      levels: [1, 5, 10, 19], availableLevels: zstdRange, supportsLevels: true,
      extension: '.zst', provider: 'zstd-codec', nativeSupported: wasmSupported,
    },
  ];
}

// ─── Main benchmark runner ───

export async function runBenchmarks(
  data: Uint8Array,
  config: BenchmarkConfig,
  onProgress: (current: number, total: number, name: string) => void,
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const iters = config.iterations;
  const tasks: Array<{ name: string; fn: () => Promise<RawBenchmarkResult | null> }> = [];

  for (const algo of config.algorithms) {
    if (!algo.enabled) continue;

    if (algo.id === 'gzip-js') {
      for (const level of algo.levels) {
        tasks.push({ name: `Gzip L${level} [JS]`, fn: () => benchmarkFflateGzip(data, level, iters) });
      }
    } else if (algo.id === 'deflate-js') {
      for (const level of algo.levels) {
        tasks.push({ name: `Deflate L${level} [JS]`, fn: () => benchmarkFflateDeflate(data, level, iters) });
      }
    } else if (algo.id === 'zlib-js') {
      for (const level of algo.levels) {
        tasks.push({ name: `Zlib L${level} [JS]`, fn: () => benchmarkFflateZlib(data, level, iters) });
      }
    } else if (algo.id === 'gzip-native') {
      tasks.push({ name: 'Gzip [Native]', fn: () => benchmarkNative(data, 'gzip', 'Gzip [Native]', '.gz', 'gzip', iters) });
    } else if (algo.id === 'deflate-native') {
      tasks.push({ name: 'Deflate [Native]', fn: () => benchmarkNative(data, 'deflate', 'Deflate [Native]', '.deflate', 'deflate', iters) });
    } else if (algo.id === 'deflate-raw-native') {
      tasks.push({ name: 'Deflate-Raw [Native]', fn: () => benchmarkNative(data, 'deflate-raw', 'Deflate-Raw [Native]', '.deflate', 'deflate-raw', iters) });
    } else if (algo.id === 'brotli-native') {
      tasks.push({ name: 'Brotli [Native]', fn: () => benchmarkNative(data, 'brotli', 'Brotli [Native]', '.br', 'brotli', iters) });
    } else if (algo.id === 'brotli-wasm') {
      for (const quality of algo.levels) {
        tasks.push({ name: `Brotli Q${quality} [WASM]`, fn: () => benchmarkBrotliWasm(data, quality, iters) });
      }
    } else if (algo.id === 'zstd-native') {
      tasks.push({ name: 'Zstandard [Native]', fn: () => benchmarkNative(data, 'zstd', 'Zstandard [Native]', '.zst', 'zstd', iters) });
    } else if (algo.id === 'zstd-wasm') {
      for (const level of algo.levels) {
        tasks.push({ name: `Zstd L${level} [WASM]`, fn: () => benchmarkZstdCodec(data, level, iters) });
      }
    }
  }

  const runId = `run_${Date.now()}_${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

  for (let i = 0; i < tasks.length; i++) {
    onProgress(i, tasks.length, tasks[i].name);
    await yieldToUI();

    try {
      const rawResult = await tasks[i].fn();
      if (!rawResult) continue;

      try {
        rawResult.outputKey = await storeBenchmarkOutput(runId, i, rawResult.compressedData);
      } catch (error) {
        // Keep benchmark metrics even when browser storage quota is exhausted.
        console.warn('Unable to cache compressed benchmark output', error);
        rawResult.outputKey = null;
      }

      const { compressedData, ...result } = rawResult;
      void compressedData;
      results.push(result);
    } catch {
      // Keep the benchmark matrix moving if one provider/level fails.
    }
  }

  onProgress(tasks.length, tasks.length, 'Complete');
  return results;
}
