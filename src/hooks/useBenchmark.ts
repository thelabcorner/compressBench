import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { runBenchmarks, getDefaultAlgorithms } from '@/lib/compression';
import { computeFileSHA256 } from '@/lib/hash';
import { runLargeFileBenchmarks, LARGE_FILE_STREAMING_THRESHOLD } from '@/lib/largeFileBenchmark';
import { saveBenchmarkHistory } from '@/lib/history';
import { getBestPerFamily } from '@/lib/download';
import { deleteBenchmarkOutputs } from '@/lib/outputStore';
import type {
  FileInfo, BenchmarkResult, BenchmarkStatus, ChartMetric, ChartSort,
  BenchmarkConfig, BenchmarkHistoryEntry,
} from '@/types';

const EMPTY_BEST_VALUES = {
  bestRatio: 0,
  bestSpeed: 0,
  bestThroughput: 0,
  smallestSize: 0,
  bestDecompSpeed: 0,
  bestDecompThroughput: 0,
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException('Benchmark cancelled', 'AbortError');
}

async function runFileBenchmark(
  source: File,
  sourceHash: string,
  config: BenchmarkConfig,
  onProgress: (current: number, total: number, name: string) => void,
  signal: AbortSignal,
  onNotice: (message: string) => void,
): Promise<BenchmarkResult[]> {
  if (source.size >= LARGE_FILE_STREAMING_THRESHOLD) {
    return runLargeFileBenchmarks(source, sourceHash, config, onProgress, signal, onNotice);
  }

  throwIfAborted(signal);
  const data = new Uint8Array(await source.arrayBuffer());
  throwIfAborted(signal);
  return runBenchmarks(data, config, onProgress);
}

export function useBenchmark() {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [status, setStatus] = useState<BenchmarkStatus>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'ratio' | 'speed' | 'throughput' | 'size' | 'decompSpeed' | 'decompThroughput'>('ratio');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('pctSaved');
  const [chartSort, setChartSort] = useState<ChartSort>('family');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<BenchmarkHistoryEntry | null>(null);
  const [config, setConfig] = useState<BenchmarkConfig | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getDefaultAlgorithms().then(algos => {
      setConfig({ iterations: 3, algorithms: algos });
    });
    return () => { abortRef.current?.abort(); };
  }, []);

  const addNotice = useCallback((message: string) => {
    setNotices(current => current.includes(message) ? current : [...current, message]);
  }, []);

  const releaseOutputs = useCallback((items: readonly BenchmarkResult[]) => {
    const keys = items.map(result => result.outputKey);
    if (keys.some(Boolean)) void deleteBenchmarkOutputs(keys);
  }, []);

  const beginRun = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, []);

  // ─── Chart sorting ───

  const chartSortedResults = useMemo(() => {
    const arr = [...results];
    const familyOrder: Record<string, number> = {
      gzip: 0,
      deflate: 1,
      'deflate-raw': 2,
      zlib: 3,
      brotli: 4,
      zstd: 5,
    };

    const getVal = (r: BenchmarkResult): number => {
      switch (chartMetric) {
        case 'pctSaved': return r.compressionLossPct;
        case 'throughput': return r.throughputCompress;
        case 'compressTime': return r.compressTime;
        case 'compressedSize': return r.compressedSize;
        case 'decompressTime': return r.decompressTime;
        case 'decompressThroughput': return r.throughputDecompress;
      }
    };

    switch (chartSort) {
      case 'name':
        return arr.sort((a, b) => a.algorithm.localeCompare(b.algorithm));
      case 'family':
        return arr.sort((a, b) => {
          const fi = (familyOrder[a.algorithmFamily] ?? 999) - (familyOrder[b.algorithmFamily] ?? 999);
          if (fi !== 0) return fi;
          if (a.provider !== b.provider) {
            if (a.provider === 'native') return -1;
            if (b.provider === 'native') return 1;
          }
          return a.algorithm.localeCompare(b.algorithm);
        });
      case 'value': {
        const higherIsBetter = chartMetric === 'pctSaved' || chartMetric === 'throughput' || chartMetric === 'decompressThroughput';
        return arr.sort((a, b) => higherIsBetter ? getVal(b) - getVal(a) : getVal(a) - getVal(b));
      }
    }
  }, [results, chartSort, chartMetric]);

  // ─── Table sorted results ───

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'ratio': aVal = a.compressionRatio; bVal = b.compressionRatio; break;
        case 'speed': aVal = a.compressTime; bVal = b.compressTime;
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        case 'throughput': aVal = a.throughputCompress; bVal = b.throughputCompress; break;
        case 'size': aVal = a.compressedSize; bVal = b.compressedSize;
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        case 'decompSpeed': aVal = a.decompressTime; bVal = b.decompressTime;
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        case 'decompThroughput': aVal = a.throughputDecompress; bVal = b.throughputDecompress; break;
        default: aVal = a.compressionRatio; bVal = b.compressionRatio;
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [results, sortBy, sortDir]);

  // ─── Best values ───

  const bestValues = useMemo(() => {
    if (results.length === 0) return EMPTY_BEST_VALUES;

    let bestRatio = Number.NEGATIVE_INFINITY;
    let bestSpeed = Number.POSITIVE_INFINITY;
    let bestThroughput = Number.NEGATIVE_INFINITY;
    let smallestSize = Number.POSITIVE_INFINITY;
    let bestDecompSpeed = Number.POSITIVE_INFINITY;
    let bestDecompThroughput = Number.NEGATIVE_INFINITY;

    for (const r of results) {
      if (r.compressionRatio > bestRatio) bestRatio = r.compressionRatio;
      if (r.compressTime < bestSpeed) bestSpeed = r.compressTime;
      if (r.throughputCompress > bestThroughput) bestThroughput = r.throughputCompress;
      if (r.compressedSize < smallestSize) smallestSize = r.compressedSize;
      if (r.decompressTime < bestDecompSpeed) bestDecompSpeed = r.decompressTime;
      if (r.throughputDecompress > bestDecompThroughput) bestDecompThroughput = r.throughputDecompress;
    }

    return {
      bestRatio,
      bestSpeed,
      bestThroughput,
      smallestSize,
      bestDecompSpeed,
      bestDecompThroughput,
    };
  }, [results]);

  const bestPerFamily = useMemo(() => getBestPerFamily(results), [results]);

  // ─── Handlers ───

  const handleFile = useCallback(async (f: File) => {
    if (!config) return;
    const controller = beginRun();
    releaseOutputs(results);
    setError(null);
    setNotices([]);
    setResults([]);
    setExpandedRow(null);
    setShowHistory(false);
    setViewingHistory(null);
    setStatus('loading');
    setProgress({ current: 0, total: 0, name: 'Computing SHA-256' });

    try {
      const hash = await computeFileSHA256(f, controller.signal);
      throwIfAborted(controller.signal);

      const fileInfo: FileInfo = {
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        source: f,
        hash,
      };

      setFile(fileInfo);
      setStatus('running');

      const benchResults = await runFileBenchmark(
        f,
        hash,
        config,
        (current, total, name) => setProgress({ current, total, name }),
        controller.signal,
        addNotice,
      );
      throwIfAborted(controller.signal);

      setResults(benchResults);
      setStatus('complete');

      await saveBenchmarkHistory(
        fileInfo.name, fileInfo.size, fileInfo.type, fileInfo.hash,
        config.iterations, benchResults,
      );
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [addNotice, beginRun, config, releaseOutputs, results]);

  const handleRerun = useCallback(async () => {
    if (!file || !config) return;
    const controller = beginRun();
    releaseOutputs(results);
    setResults([]);
    setExpandedRow(null);
    setError(null);
    setNotices([]);
    setStatus('running');

    try {
      const benchResults = await runFileBenchmark(
        file.source,
        file.hash,
        config,
        (current, total, name) => setProgress({ current, total, name }),
        controller.signal,
        addNotice,
      );
      throwIfAborted(controller.signal);

      setResults(benchResults);
      setStatus('complete');

      await saveBenchmarkHistory(
        file.name, file.size, file.type, file.hash,
        config.iterations, benchResults,
      );
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [addNotice, beginRun, file, config, releaseOutputs, results]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    releaseOutputs(results);
    setFile(null);
    setResults([]);
    setStatus('idle');
    setError(null);
    setNotices([]);
    setExpandedRow(null);
    setViewingHistory(null);
    setProgress({ current: 0, total: 0, name: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [releaseOutputs, results]);

  const handleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir(col === 'speed' || col === 'size' || col === 'decompSpeed' ? 'asc' : 'desc'); }
  }, [sortBy]);

  const { enabledCount, totalTasks } = useMemo(() => {
    let enabled = 0;
    let tasks = 0;
    if (!config) return { enabledCount: 0, totalTasks: 0 };

    for (const algo of config.algorithms) {
      if (!algo.enabled) continue;
      enabled++;
      tasks += algo.supportsLevels ? algo.levels.length : 1;
    }
    return { enabledCount: enabled, totalTasks: tasks };
  }, [config]);

  return {
    // State
    file, results, status, progress, error, notices, config,
    sortBy, sortDir, expandedRow, chartMetric, chartSort,
    showSettings, showHistory, viewingHistory, isDragging,
    fileInputRef,
    // Computed
    chartSortedResults, sortedResults, bestValues, bestPerFamily,
    enabledCount, totalTasks,
    // Setters
    setConfig, setExpandedRow, setChartMetric, setChartSort,
    setShowSettings, setShowHistory, setViewingHistory,
    // Handlers
    handleFile, handleRerun, handleDrop, handleDragOver, handleDragLeave,
    handleReset, handleSort,
  };
}
