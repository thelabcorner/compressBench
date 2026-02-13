export interface FileInfo {
  name: string;
  size: number;
  type: string;
  data: Uint8Array;
  hash: string;
}

export interface AlgorithmConfig {
  id: string;
  name: string;
  family: string;
  enabled: boolean;
  levels: number[];
  availableLevels: number[];
  supportsLevels: boolean;
  extension: string;
  provider: 'fflate' | 'native' | 'brotli-wasm' | 'zstd-codec';
  nativeSupported: boolean;
}

export interface BenchmarkConfig {
  iterations: number;
  algorithms: AlgorithmConfig[];
}

export interface BenchmarkResult {
  algorithm: string;
  algorithmFamily: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionLossPct: number;
  compressTime: number;
  compressTimeMin: number;
  compressTimeMax: number;
  decompressTime: number;
  decompressTimeMin: number;
  decompressTimeMax: number;
  throughputCompress: number;
  throughputDecompress: number;
  compressedData: Uint8Array;
  verified: boolean;
  extension: string;
  level?: number;
  iterations: number;
  provider: 'fflate' | 'native' | 'brotli-wasm' | 'zstd-codec';
  providerLabel: string;
}

// Stored version without binary data
export interface StoredBenchmarkResult {
  algorithm: string;
  algorithmFamily: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionLossPct: number;
  compressTime: number;
  compressTimeMin: number;
  compressTimeMax: number;
  decompressTime: number;
  decompressTimeMin: number;
  decompressTimeMax: number;
  throughputCompress: number;
  throughputDecompress: number;
  verified: boolean;
  extension: string;
  level?: number;
  iterations: number;
  provider: 'fflate' | 'native' | 'brotli-wasm' | 'zstd-codec';
  providerLabel: string;
}

export interface BenchmarkHistoryEntry {
  id: string;
  timestamp: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileHash: string;
  iterationsUsed: number;
  results: StoredBenchmarkResult[];
}

export type BenchmarkStatus = 'idle' | 'loading' | 'running' | 'complete' | 'error';

export type ChartMetric = 'pctSaved' | 'throughput' | 'compressTime' | 'compressedSize' | 'decompressTime' | 'decompressThroughput';

export type ChartSort = 'name' | 'value' | 'family';

export type Theme = 'light' | 'dark' | 'system';
