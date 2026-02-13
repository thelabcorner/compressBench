import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { runBenchmarks, getDefaultAlgorithms } from '@/lib/compression';
import { computeSHA256 } from '@/lib/hash';
import { saveBenchmarkHistory } from '@/lib/history';
import { getBestPerFamily } from '@/lib/download';
import type {
  FileInfo, BenchmarkResult, BenchmarkStatus, ChartMetric, ChartSort,
  BenchmarkConfig, BenchmarkHistoryEntry,
} from '@/types';

export function useBenchmark() {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [status, setStatus] = useState<BenchmarkStatus>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [error, setError] = useState<string | null>(null);
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

  // Initialize algorithm config
  useEffect(() => {
    getDefaultAlgorithms().then(algos => {
      setConfig({ iterations: 3, algorithms: algos });
    });
  }, []);

  // ─── Chart sorting ───

  const chartSortedResults = useMemo(() => {
    const arr = [...results];
    const familyOrder = ['gzip', 'deflate', 'deflate-raw', 'zlib', 'brotli', 'zstd'];

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
          const fi = familyOrder.indexOf(a.algorithmFamily) - familyOrder.indexOf(b.algorithmFamily);
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

  const bestValues = useMemo(() => ({
    bestRatio: results.length > 0 ? Math.max(...results.map(r => r.compressionRatio)) : 0,
    bestSpeed: results.length > 0 ? Math.min(...results.map(r => r.compressTime)) : 0,
    bestThroughput: results.length > 0 ? Math.max(...results.map(r => r.throughputCompress)) : 0,
    smallestSize: results.length > 0 ? Math.min(...results.map(r => r.compressedSize)) : 0,
    bestDecompSpeed: results.length > 0 ? Math.min(...results.map(r => r.decompressTime)) : 0,
    bestDecompThroughput: results.length > 0 ? Math.max(...results.map(r => r.throughputDecompress)) : 0,
  }), [results]);

  const bestPerFamily = useMemo(() => getBestPerFamily(results), [results]);

  // ─── Handlers ───

  const handleFile = useCallback(async (f: File) => {
    if (!config) return;
    setError(null);
    setResults([]);
    setExpandedRow(null);
    setShowHistory(false);
    setViewingHistory(null);
    setStatus('loading');

    try {
      const arrayBuffer = await f.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const hash = await computeSHA256(data);

      const fileInfo: FileInfo = {
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        data,
        hash,
      };

      setFile(fileInfo);
      setStatus('running');

      const benchResults = await runBenchmarks(data, config, (current, total, name) => {
        setProgress({ current, total, name });
      });

      setResults(benchResults);
      setStatus('complete');

      await saveBenchmarkHistory(
        fileInfo.name, fileInfo.size, fileInfo.type, fileInfo.hash,
        config.iterations, benchResults,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  }, [config]);

  const handleRerun = useCallback(async () => {
    if (!file || !config) return;
    setResults([]);
    setExpandedRow(null);
    setStatus('running');
    try {
      const benchResults = await runBenchmarks(file.data, config, (current, total, name) => {
        setProgress({ current, total, name });
      });
      setResults(benchResults);
      setStatus('complete');

      await saveBenchmarkHistory(
        file.name, file.size, file.type, file.hash,
        config.iterations, benchResults,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  }, [file, config]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleReset = useCallback(() => {
    setFile(null);
    setResults([]);
    setStatus('idle');
    setError(null);
    setExpandedRow(null);
    setViewingHistory(null);
    setProgress({ current: 0, total: 0, name: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir(col === 'speed' || col === 'size' || col === 'decompSpeed' ? 'asc' : 'desc'); }
  }, [sortBy]);

  const enabledCount = config?.algorithms.filter(a => a.enabled).length ?? 0;
  const totalTasks = config?.algorithms.filter(a => a.enabled).reduce((sum, a) => sum + (a.supportsLevels ? a.levels.length : 1), 0) ?? 0;

  return {
    // State
    file, results, status, progress, error, config,
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
