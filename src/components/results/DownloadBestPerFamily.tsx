import { PackageOpen, Download } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes, formatRatio } from '@/lib/format';
import { getFamilyColor } from '@/constants';
import { downloadBlob } from '@/lib/download';
import type { BenchmarkResult } from '@/types';

interface DownloadBestPerFamilyProps {
  bestPerFamily: BenchmarkResult[];
  fileName: string;
}

export function DownloadBestPerFamily({ bestPerFamily, fileName }: DownloadBestPerFamilyProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <PackageOpen className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /> Download Best Per Algorithm
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Best compression ratio for each algorithm family</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bestPerFamily.map((r, i) => {
          const color = getFamilyColor(r.algorithmFamily);
          return (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", color.dot)} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{r.algorithm}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{formatBytes(r.compressedSize)} · {formatRatio(r.compressionRatio)}</p>
                </div>
              </div>
              <button
                onClick={() => downloadBlob(r.compressedData, `${fileName}${r.extension}`)}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600 rounded-lg transition-colors"
              >
                <Download className="w-3 h-3" /> {r.extension}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
