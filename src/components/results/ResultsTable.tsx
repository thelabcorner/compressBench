import { Trophy, CheckCircle2, XCircle, Download } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes, formatTime, formatThroughput, formatRatio } from '@/lib/format';
import { getFamilyColor, getProviderBadgeClass } from '@/constants';
import { ProviderIcon } from '@/components/ui/ProviderBadge';
import { SortIcon } from '@/components/ui/SortIcon';
import { downloadBlob } from '@/lib/download';
import type { BenchmarkResult } from '@/types';

type SortColumn = 'ratio' | 'speed' | 'throughput' | 'size' | 'decompSpeed' | 'decompThroughput';

interface ResultsTableProps {
  sortedResults: BenchmarkResult[];
  fileName: string;
  iterations: number;
  isDark: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  expandedRow: number | null;
  bestValues: {
    bestRatio: number;
    smallestSize: number;
    bestSpeed: number;
    bestThroughput: number;
    bestDecompSpeed: number;
    bestDecompThroughput: number;
  };
  onSort: (col: SortColumn) => void;
  onExpandRow: (row: number | null) => void;
}

export function ResultsTable({
  sortedResults, fileName, iterations, isDark,
  sortBy, sortDir, expandedRow, bestValues,
  onSort, onExpandRow,
}: ResultsTableProps) {
  const { bestRatio, smallestSize, bestSpeed, bestThroughput, bestDecompSpeed, bestDecompThroughput } = bestValues;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Detailed Results</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Click row for details · Click headers to sort · Showing avg of {iterations}× iterations</p>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="text-left px-4 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Algorithm</th>
              <th className="text-left px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Provider</th>
              {([
                ['size', 'Size'], ['ratio', 'Ratio'], ['speed', 'Compress'],
                ['throughput', 'C.Thru'], ['decompSpeed', 'Decomp'], ['decompThroughput', 'D.Thru'],
              ] as [SortColumn, string][]).map(([col, label]) => (
                <th key={col} className="text-right px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none" onClick={() => onSort(col)}>
                  <span className="inline-flex items-center gap-1">{label} <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} /></span>
                </th>
              ))}
              <th className="text-center px-3 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">OK</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">DL</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((r, i) => {
              const isBestRatio = r.compressionRatio === bestRatio;
              const isFastest = r.compressTime === bestSpeed;
              const isBestTP = r.throughputCompress === bestThroughput;
              const isSmallest = r.compressedSize === smallestSize;
              const isBestDecomp = r.decompressTime === bestDecompSpeed;
              const isBestDecompTP = r.throughputDecompress === bestDecompThroughput;
              const isExpanded = expandedRow === i;
              const color = getFamilyColor(r.algorithmFamily);

              return (
                <tr key={i}
                  className={cn("border-b border-zinc-50 dark:border-zinc-800/50 cursor-pointer transition-colors",
                    isExpanded ? "bg-zinc-50 dark:bg-zinc-800/50" : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"
                  )}
                  onClick={() => onExpandRow(isExpanded ? null : i)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", color.dot)} />
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.algorithm}</span>
                      {(isBestRatio || isFastest || isSmallest) && <Trophy className="w-3 h-3 text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-0.5", getProviderBadgeClass(r.provider, isDark))}>
                      <ProviderIcon provider={r.provider} /> {r.providerLabel}
                    </span>
                  </td>
                  <td className="text-right px-3 py-3"><span className={cn("text-xs font-mono tabular-nums", isSmallest ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-zinc-700 dark:text-zinc-300")}>{formatBytes(r.compressedSize)}</span></td>
                  <td className="text-right px-3 py-3"><span className={cn("text-xs font-mono tabular-nums", isBestRatio ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-zinc-700 dark:text-zinc-300")}>{formatRatio(r.compressionRatio)}</span></td>
                  <td className="text-right px-3 py-3"><span className={cn("text-xs font-mono tabular-nums", isFastest ? "text-violet-600 dark:text-violet-400 font-semibold" : "text-zinc-700 dark:text-zinc-300")}>{formatTime(r.compressTime)}</span></td>
                  <td className="text-right px-3 py-3"><span className={cn("text-xs font-mono tabular-nums", isBestTP ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-zinc-700 dark:text-zinc-300")}>{formatThroughput(r.throughputCompress)}</span></td>
                  <td className="text-right px-3 py-3"><span className={cn("text-xs font-mono tabular-nums", isBestDecomp ? "text-pink-600 dark:text-pink-400 font-semibold" : "text-zinc-700 dark:text-zinc-300")}>{formatTime(r.decompressTime)}</span></td>
                  <td className="text-right px-3 py-3"><span className={cn("text-xs font-mono tabular-nums", isBestDecompTP ? "text-cyan-600 dark:text-cyan-400 font-semibold" : "text-zinc-700 dark:text-zinc-300")}>{formatThroughput(r.throughputDecompress)}</span></td>
                  <td className="text-center px-3 py-3">{r.verified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />}</td>
                  <td className="text-right px-4 py-3">
                    <button onClick={e => { e.stopPropagation(); downloadBlob(r.compressedData, `${fileName}${r.extension}`); }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors">
                      <Download className="w-3 h-3" /> {r.extension}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
        {sortedResults.map((r, i) => {
          const isBestRatio = r.compressionRatio === bestRatio;
          const isFastest = r.compressTime === bestSpeed;
          const isSmallest = r.compressedSize === smallestSize;
          const color = getFamilyColor(r.algorithmFamily);

          return (
            <div key={i} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", color.dot)} />
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border",
                    isDark ? getFamilyColor(r.algorithmFamily).badgeDark : getFamilyColor(r.algorithmFamily).badge
                  )}>{r.algorithm}</span>
                  {(isBestRatio || isFastest || isSmallest) && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-0.5",
                    getProviderBadgeClass(r.provider, isDark)
                  )}><ProviderIcon provider={r.provider} /> {r.providerLabel}</span>
                  {r.verified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { l: 'Compressed', v: formatBytes(r.compressedSize) },
                  { l: 'Ratio', v: formatRatio(r.compressionRatio) },
                  { l: 'Compress', v: formatTime(r.compressTime) },
                  { l: 'Decompress', v: formatTime(r.decompressTime) },
                  { l: 'C.Thru', v: formatThroughput(r.throughputCompress) },
                  { l: 'D.Thru', v: formatThroughput(r.throughputDecompress) },
                ].map((cell, ci) => (
                  <div key={ci} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                    <span className="text-zinc-400 dark:text-zinc-500 block text-[10px]">{cell.l}</span>
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">{cell.v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => downloadBlob(r.compressedData, `${fileName}${r.extension}`)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" /> Download {r.extension}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
