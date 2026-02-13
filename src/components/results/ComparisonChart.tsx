import { Trophy, Globe } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes, formatTime, formatThroughput, formatPercent } from '@/lib/format';
import { CHART_METRICS, CHART_SORTS, FAMILY_COLORS, getFamilyColor } from '@/constants';
import type { BenchmarkResult, ChartMetric, ChartSort } from '@/types';

interface ComparisonChartProps {
  results: BenchmarkResult[];
  chartSortedResults: BenchmarkResult[];
  chartMetric: ChartMetric;
  chartSort: ChartSort;
  onMetricChange: (m: ChartMetric) => void;
  onSortChange: (s: ChartSort) => void;
}

function getChartValue(r: BenchmarkResult, metric: ChartMetric): number {
  switch (metric) {
    case 'pctSaved': return r.compressionLossPct;
    case 'throughput': return r.throughputCompress;
    case 'compressTime': return r.compressTime;
    case 'compressedSize': return r.compressedSize;
    case 'decompressTime': return r.decompressTime;
    case 'decompressThroughput': return r.throughputDecompress;
  }
}

function getChartLabel(r: BenchmarkResult, metric: ChartMetric): string {
  switch (metric) {
    case 'pctSaved': return formatPercent(r.compressionLossPct);
    case 'throughput': return formatThroughput(r.throughputCompress);
    case 'compressTime': return formatTime(r.compressTime);
    case 'compressedSize': return formatBytes(r.compressedSize);
    case 'decompressTime': return formatTime(r.decompressTime);
    case 'decompressThroughput': return formatThroughput(r.throughputDecompress);
  }
}

function getChartSubtitle(metric: ChartMetric): string {
  switch (metric) {
    case 'pctSaved': return 'Percentage of original file size eliminated';
    case 'throughput': return 'Compression throughput (MB/s) — higher is better';
    case 'compressTime': return 'Time taken to compress — shorter is better';
    case 'compressedSize': return 'Compressed size relative to original';
    case 'decompressTime': return 'Time taken to decompress — shorter is better';
    case 'decompressThroughput': return 'Decompression throughput (MB/s) — higher is better';
  }
}

export function ComparisonChart({ results, chartSortedResults, chartMetric, chartSort, onMetricChange, onSortChange }: ComparisonChartProps) {
  const vals = chartSortedResults.map(r => getChartValue(r, chartMetric));
  const maxVal = Math.max(...vals);

  const getBarPct = (r: BenchmarkResult): number => {
    switch (chartMetric) {
      case 'pctSaved': return Math.max(r.compressionLossPct, 0.5);
      case 'throughput': return maxVal > 0 ? (r.throughputCompress / maxVal) * 100 : 0;
      case 'compressTime': return maxVal > 0 ? (r.compressTime / maxVal) * 100 : 0;
      case 'compressedSize': return (r.compressedSize / r.originalSize) * 100;
      case 'decompressTime': return maxVal > 0 ? (r.decompressTime / maxVal) * 100 : 0;
      case 'decompressThroughput': return maxVal > 0 ? (r.throughputDecompress / maxVal) * 100 : 0;
    }
  };

  const getIsBest = (r: BenchmarkResult): boolean => {
    switch (chartMetric) {
      case 'pctSaved': return r.compressionLossPct === Math.max(...results.map(x => x.compressionLossPct));
      case 'throughput': return r.throughputCompress === Math.max(...results.map(x => x.throughputCompress));
      case 'compressTime': return r.compressTime === Math.min(...results.map(x => x.compressTime));
      case 'compressedSize': return r.compressedSize === Math.min(...results.map(x => x.compressedSize));
      case 'decompressTime': return r.decompressTime === Math.min(...results.map(x => x.decompressTime));
      case 'decompressThroughput': return r.throughputDecompress === Math.max(...results.map(x => x.throughputDecompress));
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Compression Comparison</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{getChartSubtitle(chartMetric)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium mr-1">Sort:</span>
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              {CHART_SORTS.map(s => (
                <button key={s.key} onClick={() => onSortChange(s.key)}
                  className={cn("flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-all",
                    chartSort === s.key ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}>
                  {s.icon} <span className="hidden sm:inline">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 self-start flex-wrap">
          {CHART_METRICS.map(m => (
            <button key={m.key} onClick={() => onMetricChange(m.key)}
              className={cn("flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all",
                chartMetric === m.key ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}>
              {m.icon} <span className="hidden sm:inline">{m.label}</span><span className="sm:hidden">{m.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {chartSortedResults.map((r, i) => {
          const barPct = getBarPct(r);
          const isBest = getIsBest(r);
          const color = getFamilyColor(r.algorithmFamily);
          const isNative = r.provider === 'native';
          return (
            <div key={i} className="group">
              <div className="flex items-center gap-3">
                <div className="w-36 sm:w-48 shrink-0 flex items-center gap-2">
                  {isBest ? <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                  <div className={cn("w-2 h-2 rounded-full shrink-0", color.dot)} />
                  <span className={cn("text-xs font-medium truncate", isBest ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400")}>
                    {r.algorithm}
                  </span>
                  {isNative && <Globe className="w-3 h-3 text-emerald-500 shrink-0" />}
                </div>
                <div className="flex-1 h-7 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden relative">
                  <div className={cn("h-full rounded-md transition-all duration-500 animate-progress", color.bar, isBest ? 'opacity-100' : 'opacity-50', isNative && 'opacity-90')}
                    style={{ width: `${Math.max(barPct, 1)}%` }} />
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {getChartLabel(r, chartMetric)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-emerald-500" /> <span>= Native Browser API</span>
        </div>
        {Object.entries(FAMILY_COLORS).map(([family, colors]) => {
          if (!results.some(r => r.algorithmFamily === family)) return null;
          return (
            <div key={family} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", colors.dot)} />
              <span className="capitalize">{family}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
