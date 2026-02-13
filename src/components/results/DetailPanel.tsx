import {
  HardDrive, ArrowDownToLine, TrendingDown, BarChart3,
  Timer, Zap, Gauge, CheckCircle2, XCircle, Download,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes, formatTime, formatThroughput, formatRatio, formatPercent, formatTimeRange } from '@/lib/format';
import { getFamilyColor, getProviderBadgeClass } from '@/constants';
import { ProviderIcon } from '@/components/ui/ProviderBadge';
import { DetailCard } from '@/components/ui/DetailCard';
import { downloadBlob } from '@/lib/download';
import type { BenchmarkResult } from '@/types';

interface DetailPanelProps {
  result: BenchmarkResult;
  fileName: string;
  isDark: boolean;
  onClose: () => void;
}

export function DetailPanel({ result: r, fileName, isDark, onClose }: DetailPanelProps) {
  const color = getFamilyColor(r.algorithmFamily);

  return (
    <div className="animate-slide-up bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", color.dot)} />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.algorithm} — Detail View</h3>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-0.5",
            getProviderBadgeClass(r.provider, isDark)
          )}>
            <ProviderIcon provider={r.provider} /> {r.providerLabel}
          </span>
        </div>
        <button onClick={onClose} className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300">Close</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DetailCard label="Original Size" value={formatBytes(r.originalSize)} icon={<HardDrive className="w-4 h-4" />} />
        <DetailCard label="Compressed Size" value={formatBytes(r.compressedSize)} icon={<ArrowDownToLine className="w-4 h-4" />} />
        <DetailCard label="Ratio" value={formatRatio(r.compressionRatio)} icon={<TrendingDown className="w-4 h-4" />} />
        <DetailCard label="Size Reduction" value={formatPercent(r.compressionLossPct)} icon={<BarChart3 className="w-4 h-4" />} />
        <DetailCard label="Compress Time (avg)" value={formatTime(r.compressTime)}
          subValue={r.iterations > 1 ? `min: ${formatTime(r.compressTimeMin)} · max: ${formatTime(r.compressTimeMax)}` : undefined}
          icon={<Timer className="w-4 h-4" />} />
        <DetailCard label="Decompress Time (avg)" value={formatTime(r.decompressTime)}
          subValue={r.iterations > 1 ? `min: ${formatTime(r.decompressTimeMin)} · max: ${formatTime(r.decompressTimeMax)}` : undefined}
          icon={<Timer className="w-4 h-4" />} />
        <DetailCard label="Compress Throughput" value={formatThroughput(r.throughputCompress)} icon={<Zap className="w-4 h-4" />} />
        <DetailCard label="Decompress Throughput" value={formatThroughput(r.throughputDecompress)} icon={<Gauge className="w-4 h-4" />} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm">
          {r.verified
            ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">Integrity verified</span></>
            : <><XCircle className="w-4 h-4 text-red-500" /><span className="text-red-700 dark:text-red-400 font-medium text-xs">Integrity check failed</span></>}
        </div>
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{r.iterations}× iterations</span>
        {r.iterations > 1 && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Compress: {formatTimeRange(r.compressTimeMin, r.compressTimeMax)} · Decompress: {formatTimeRange(r.decompressTimeMin, r.decompressTimeMax)}</span>
          </>
        )}
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <button onClick={() => downloadBlob(r.compressedData, `${fileName}${r.extension}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" /> Download {r.extension}
        </button>
      </div>
    </div>
  );
}
