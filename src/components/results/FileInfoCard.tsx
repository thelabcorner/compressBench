import { HardDrive, Hash } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import { CopyHashButton } from '@/components/ui/CopyHashButton';
import { BrowserSupportBadges } from '@/components/BrowserSupportBadges';
import type { FileInfo, AlgorithmConfig } from '@/types';

interface FileInfoCardProps {
  file: FileInfo;
  resultCount: number;
  iterations: number;
  algorithms: AlgorithmConfig[];
}

export function FileInfoCard({ file, resultCount, iterations, algorithms }: FileInfoCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[280px] sm:max-w-none">{file.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatBytes(file.size)} · {file.type} · {resultCount} benchmarks · {iterations}× iterations
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
          <Hash className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide shrink-0">SHA-256</span>
          <code className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 truncate flex-1">{file.hash}</code>
          <CopyHashButton hash={file.hash} />
        </div>
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <BrowserSupportBadges algorithms={algorithms} />
        </div>
      </div>
    </div>
  );
}
