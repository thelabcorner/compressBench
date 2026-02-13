import {
  History, X, Hash, TrendingDown, ArrowDownToLine, Timer,
  Zap, Shield, Gauge, Trophy, CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes, formatTime, formatThroughput, formatRatio } from '@/lib/format';
import { getFamilyColor, getProviderBadgeClass } from '@/constants';
import { ProviderIcon } from '@/components/ui/ProviderBadge';
import type { BenchmarkHistoryEntry, StoredBenchmarkResult } from '@/types';

function getAlgoColor(r: StoredBenchmarkResult) {
  return getFamilyColor(r.algorithmFamily);
}

interface HistoryDetailViewProps {
  entry: BenchmarkHistoryEntry;
  onClose: () => void;
  isDark: boolean;
}

export function HistoryDetailView({ entry, onClose, isDark }: HistoryDetailViewProps) {
  const results = entry.results;
  const bestRatio = Math.max(...results.map(r => r.compressionRatio));
  const smallestSize = Math.min(...results.map(r => r.compressedSize));
  const bestSpeed = Math.min(...results.map(r => r.compressTime));
  const bestThroughput = Math.max(...results.map(r => r.throughputCompress));
  const bestDecompSpeed = Math.min(...results.map(r => r.decompressTime));
  const bestDecompThroughput = Math.max(...results.map(r => r.throughputDecompress));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <History className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{entry.fileName}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatBytes(entry.fileSize)} · {entry.fileType} · {results.length} benchmarks · {entry.iterationsUsed}× iter
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Hash className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[300px]">{entry.fileHash}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Benchmark run on {new Date(entry.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Best Ratio', value: formatRatio(bestRatio), icon: <TrendingDown className="w-4 h-4 text-blue-500" />, sub: results.find(r => r.compressionRatio === bestRatio)?.algorithm },
          { label: 'Smallest', value: formatBytes(smallestSize), icon: <ArrowDownToLine className="w-4 h-4 text-emerald-500" />, sub: results.find(r => r.compressedSize === smallestSize)?.algorithm },
          { label: 'Fastest Comp', value: formatTime(bestSpeed), icon: <Timer className="w-4 h-4 text-violet-500" />, sub: results.find(r => r.compressTime === bestSpeed)?.algorithm },
          { label: 'Top Comp Thru', value: formatThroughput(bestThroughput), icon: <Zap className="w-4 h-4 text-amber-500" />, sub: results.find(r => r.throughputCompress === bestThroughput)?.algorithm },
          { label: 'Fastest Decomp', value: formatTime(bestDecompSpeed), icon: <Shield className="w-4 h-4 text-pink-500" />, sub: results.find(r => r.decompressTime === bestDecompSpeed)?.algorithm },
          { label: 'Top Decomp Thru', value: formatThroughput(bestDecompThroughput), icon: <Gauge className="w-4 h-4 text-cyan-500" />, sub: results.find(r => r.throughputDecompress === bestDecompThroughput)?.algorithm },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              {card.icon}
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">{card.value}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Results (read-only — no binary data stored)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Algorithm</th>
                <th className="text-left px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Provider</th>
                <th className="text-right px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Size</th>
                <th className="text-right px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Ratio</th>
                <th className="text-right px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Compress</th>
                <th className="text-right px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">C.Thru</th>
                <th className="text-right px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Decomp</th>
                <th className="text-right px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">D.Thru</th>
                <th className="text-center px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">OK</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const color = getAlgoColor(r);
                return (
                  <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", color.dot)} />
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.algorithm}</span>
                        {r.compressionRatio === bestRatio && <Trophy className="w-3 h-3 text-amber-500" />}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-0.5", getProviderBadgeClass(r.provider, isDark))}>
                        <ProviderIcon provider={r.provider} />
                        {r.providerLabel}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3"><span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatBytes(r.compressedSize)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatRatio(r.compressionRatio)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatTime(r.compressTime)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatThroughput(r.throughputCompress)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatTime(r.decompressTime)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-xs font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatThroughput(r.throughputDecompress)}</span></td>
                    <td className="text-center px-3 py-3">
                      {r.verified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
