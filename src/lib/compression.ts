import * as fflate from 'fflate';
import type { BenchmarkResult, AlgorithmConfig, BenchmarkConfig } from '@/types';

function highResTime(): number {
  return performance.now();
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
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
          const simple = new zstd.Simple();
          resolve(simple);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cs = new CompressionStream(format as any);
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    const testData = new Uint8Array([1, 2, 3, 4]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writer.write(testData as any);
    writer.close();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return chunks.length > 0;
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

// ─── Timing helpers ───

interface TimingStats {
  avg: number;
  min: number;
  max: number;
}

async function runTimedWithYield(fn: () => void, iterations: number): Promise<TimingStats> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    if (i > 0 && i % 3 === 0) await yieldToUI();
    const start = highResTime();
    fn();
    const end = highResTime();
    times.push(end - start);
  }
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

async function runTimedAsync(fn: () => Promise<void>, iterations: number): Promise<TimingStats> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    if (i > 0 && i % 2 === 0) await yieldToUI();
    const start = highResTime();
    await fn();
    const end = highResTime();
    times.push(end - start);
  }
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

// ─── fflate-based benchmarks ───

async function benchmarkFflateGzip(data: Uint8Array, level: number, iterations: number): Promise<BenchmarkResult> {
  let compressed!: Uint8Array;
  const compTiming = await runTimedWithYield(() => {
    compressed = fflate.gzipSync(data, { level: level as fflate.DeflateOptions['level'] });
  }, iterations);

  let decompressed!: Uint8Array;
  const decompTiming = await runTimedWithYield(() => {
    decompressed = fflate.gunzipSync(compressed);
  }, iterations);

  const verified = arraysEqual(data, decompressed);
  const originalSize = data.length;
  const compressedSize = compressed.length;

  return {
    algorithm: `Gzip L${level} [JS]`,
    algorithmFamily: 'gzip',
    originalSize, compressedSize,
    compressionRatio: originalSize / compressedSize,
    compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
    compressTime: compTiming.avg, compressTimeMin: compTiming.min, compressTimeMax: compTiming.max,
    decompressTime: decompTiming.avg, decompressTimeMin: decompTiming.min, decompressTimeMax: decompTiming.max,
    throughputCompress: (originalSize / (1024 * 1024)) / (compTiming.avg / 1000),
    throughputDecompress: (originalSize / (1024 * 1024)) / (decompTiming.avg / 1000),
    compressedData: compressed, verified,
    extension: '.gz', level, iterations,
    provider: 'fflate', providerLabel: 'fflate (JS)',
  };
}

async function benchmarkFflateDeflate(data: Uint8Array, level: number, iterations: number): Promise<BenchmarkResult> {
  let compressed!: Uint8Array;
  const compTiming = await runTimedWithYield(() => {
    compressed = fflate.deflateSync(data, { level: level as fflate.DeflateOptions['level'] });
  }, iterations);

  let decompressed!: Uint8Array;
  const decompTiming = await runTimedWithYield(() => {
    decompressed = fflate.inflateSync(compressed);
  }, iterations);

  const verified = arraysEqual(data, decompressed);
  const originalSize = data.length;
  const compressedSize = compressed.length;

  return {
    algorithm: `Deflate L${level} [JS]`,
    algorithmFamily: 'deflate',
    originalSize, compressedSize,
    compressionRatio: originalSize / compressedSize,
    compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
    compressTime: compTiming.avg, compressTimeMin: compTiming.min, compressTimeMax: compTiming.max,
    decompressTime: decompTiming.avg, decompressTimeMin: decompTiming.min, decompressTimeMax: decompTiming.max,
    throughputCompress: (originalSize / (1024 * 1024)) / (compTiming.avg / 1000),
    throughputDecompress: (originalSize / (1024 * 1024)) / (decompTiming.avg / 1000),
    compressedData: compressed, verified,
    extension: '.deflate', level, iterations,
    provider: 'fflate', providerLabel: 'fflate (JS)',
  };
}

async function benchmarkFflateZlib(data: Uint8Array, level: number, iterations: number): Promise<BenchmarkResult> {
  let compressed!: Uint8Array;
  const compTiming = await runTimedWithYield(() => {
    compressed = fflate.zlibSync(data, { level: level as fflate.DeflateOptions['level'] });
  }, iterations);

  let decompressed!: Uint8Array;
  const decompTiming = await runTimedWithYield(() => {
    decompressed = fflate.unzlibSync(compressed);
  }, iterations);

  const verified = arraysEqual(data, decompressed);
  const originalSize = data.length;
  const compressedSize = compressed.length;

  return {
    algorithm: `Zlib L${level} [JS]`,
    algorithmFamily: 'zlib',
    originalSize, compressedSize,
    compressionRatio: originalSize / compressedSize,
    compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
    compressTime: compTiming.avg, compressTimeMin: compTiming.min, compressTimeMax: compTiming.max,
    decompressTime: decompTiming.avg, decompressTimeMin: decompTiming.min, decompressTimeMax: decompTiming.max,
    throughputCompress: (originalSize / (1024 * 1024)) / (compTiming.avg / 1000),
    throughputDecompress: (originalSize / (1024 * 1024)) / (decompTiming.avg / 1000),
    compressedData: compressed, verified,
    extension: '.zz', level, iterations,
    provider: 'fflate', providerLabel: 'fflate (JS)',
  };
}

// ─── CompressionStream-based (native) benchmarks ───

async function compressNative(data: Uint8Array, format: string): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs = new CompressionStream(format as any);
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  const readAll = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writer.write(data as any);
  writer.close();
  await readAll;
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function decompressNative(data: Uint8Array, format: string): Promise<Uint8Array> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writer.write(data as any);
  writer.close();
  await readAll;
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function benchmarkNative(
  data: Uint8Array, format: string, label: string, ext: string, family: string, iterations: number
): Promise<BenchmarkResult | null> {
  try {
    let compressed!: Uint8Array;
    const compTiming = await runTimedAsync(async () => {
      compressed = await compressNative(data, format);
    }, iterations);

    await yieldToUI();

    let decompressed!: Uint8Array;
    const decompTiming = await runTimedAsync(async () => {
      decompressed = await decompressNative(compressed, format);
    }, iterations);

    const verified = arraysEqual(data, decompressed);
    const originalSize = data.length;
    const compressedSize = compressed.length;

    return {
      algorithm: label,
      algorithmFamily: family,
      originalSize, compressedSize,
      compressionRatio: originalSize / compressedSize,
      compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
      compressTime: compTiming.avg, compressTimeMin: compTiming.min, compressTimeMax: compTiming.max,
      decompressTime: decompTiming.avg, decompressTimeMin: decompTiming.min, decompressTimeMax: decompTiming.max,
      throughputCompress: (originalSize / (1024 * 1024)) / (compTiming.avg / 1000),
      throughputDecompress: (originalSize / (1024 * 1024)) / (decompTiming.avg / 1000),
      compressedData: compressed, verified,
      extension: ext, iterations,
      provider: 'native', providerLabel: 'Native Browser',
    };
  } catch {
    return null;
  }
}

// ─── Brotli WASM-based benchmark ───

async function benchmarkBrotliWasm(
  data: Uint8Array, quality: number, iterations: number
): Promise<BenchmarkResult | null> {
  const wasm = await loadBrotliWasm();
  if (!wasm) return null;

  try {
    let compressed!: Uint8Array;
    const compTiming = await runTimedWithYield(() => {
      compressed = wasm.compress(data, { quality });
    }, iterations);

    await yieldToUI();

    let decompressed!: Uint8Array;
    const decompTiming = await runTimedWithYield(() => {
      decompressed = wasm.decompress(compressed);
    }, iterations);

    const verified = arraysEqual(data, decompressed);
    const originalSize = data.length;
    const compressedSize = compressed.length;

    return {
      algorithm: `Brotli Q${quality} [WASM]`,
      algorithmFamily: 'brotli',
      originalSize, compressedSize,
      compressionRatio: originalSize / compressedSize,
      compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
      compressTime: compTiming.avg, compressTimeMin: compTiming.min, compressTimeMax: compTiming.max,
      decompressTime: decompTiming.avg, decompressTimeMin: decompTiming.min, decompressTimeMax: decompTiming.max,
      throughputCompress: (originalSize / (1024 * 1024)) / (compTiming.avg / 1000),
      throughputDecompress: (originalSize / (1024 * 1024)) / (decompTiming.avg / 1000),
      compressedData: compressed, verified,
      extension: '.br', level: quality, iterations,
      provider: 'brotli-wasm', providerLabel: 'brotli-wasm (WASM)',
    };
  } catch {
    return null;
  }
}

// ─── Zstd codec-based benchmark ───

async function benchmarkZstdCodec(
  data: Uint8Array, level: number, iterations: number
): Promise<BenchmarkResult | null> {
  const codec = await loadZstdCodec();
  if (!codec) return null;

  try {
    let compressed!: Uint8Array;
    const compTiming = await runTimedWithYield(() => {
      compressed = codec.compress(data, level);
    }, iterations);

    await yieldToUI();

    let decompressed!: Uint8Array;
    const decompTiming = await runTimedWithYield(() => {
      decompressed = codec.decompress(compressed);
    }, iterations);

    const verified = arraysEqual(data, decompressed);
    const originalSize = data.length;
    const compressedSize = compressed.length;

    return {
      algorithm: `Zstd L${level} [WASM]`,
      algorithmFamily: 'zstd',
      originalSize, compressedSize,
      compressionRatio: originalSize / compressedSize,
      compressionLossPct: ((originalSize - compressedSize) / originalSize) * 100,
      compressTime: compTiming.avg, compressTimeMin: compTiming.min, compressTimeMax: compTiming.max,
      decompressTime: decompTiming.avg, decompressTimeMin: decompTiming.min, decompressTimeMax: decompTiming.max,
      throughputCompress: (originalSize / (1024 * 1024)) / (compTiming.avg / 1000),
      throughputDecompress: (originalSize / (1024 * 1024)) / (decompTiming.avg / 1000),
      compressedData: compressed, verified,
      extension: '.zst', level, iterations,
      provider: 'zstd-codec', providerLabel: 'zstd-codec (WASM)',
    };
  } catch {
    return null;
  }
}

// ─── Default algorithm configurations ───

export async function getDefaultAlgorithms(): Promise<AlgorithmConfig[]> {
  const [nativeBrotli, nativeZstd, brotliWasmOk, zstdCodecOk] = await Promise.all([
    checkBrotliSupport(),
    checkZstdSupport(),
    checkBrotliWasmSupport(),
    checkZstdCodecSupport(),
  ]);

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
      id: 'brotli-wasm', name: 'Brotli [WASM]', family: 'brotli', enabled: brotliWasmOk,
      levels: [1, 6, 11], availableLevels: brotliRange, supportsLevels: true,
      extension: '.br', provider: 'brotli-wasm', nativeSupported: brotliWasmOk,
    },
    {
      id: 'zstd-native', name: 'Zstandard [Native]', family: 'zstd', enabled: nativeZstd,
      levels: [], availableLevels: [], supportsLevels: false,
      extension: '.zst', provider: 'native', nativeSupported: nativeZstd,
    },
    {
      id: 'zstd-wasm', name: 'Zstandard [WASM]', family: 'zstd', enabled: zstdCodecOk,
      levels: [1, 5, 10, 19], availableLevels: zstdRange, supportsLevels: true,
      extension: '.zst', provider: 'zstd-codec', nativeSupported: zstdCodecOk,
    },
  ];
}

// ─── Main benchmark runner ───

export async function runBenchmarks(
  data: Uint8Array,
  config: BenchmarkConfig,
  onProgress: (current: number, total: number, name: string) => void
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const iters = config.iterations;

  const tasks: Array<{ name: string; fn: () => Promise<BenchmarkResult | null> }> = [];

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
      for (const q of algo.levels) {
        tasks.push({ name: `Brotli Q${q} [WASM]`, fn: () => benchmarkBrotliWasm(data, q, iters) });
      }
    } else if (algo.id === 'zstd-native') {
      tasks.push({ name: 'Zstandard [Native]', fn: () => benchmarkNative(data, 'zstd', 'Zstandard [Native]', '.zst', 'zstd', iters) });
    } else if (algo.id === 'zstd-wasm') {
      for (const l of algo.levels) {
        tasks.push({ name: `Zstd L${l} [WASM]`, fn: () => benchmarkZstdCodec(data, l, iters) });
      }
    }
  }

  for (let i = 0; i < tasks.length; i++) {
    onProgress(i, tasks.length, tasks[i].name);
    await yieldToUI();
    try {
      const result = await tasks[i].fn();
      if (result) results.push(result);
    } catch {
      // skip failed
    }
  }

  onProgress(tasks.length, tasks.length, 'Complete');
  return results;
}
