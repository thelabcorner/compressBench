import { TrendingDown, ArrowDownToLine, Timer, Zap, Shield, Gauge } from 'lucide-react';
import { formatBytes, formatTime, formatThroughput, formatRatio } from '@/lib/format';
import type { BenchmarkResult } from '@/types';

interface SummaryCardsProps {
  results: BenchmarkResult[];
  bestValues: {
    bestRatio: number;
    smallestSize: number;
    bestSpeed: number;
    bestThroughput: number;
    bestDecompSpeed: number;
    bestDecompThroughput: number;
  };
}

export function SummaryCards({ results, bestValues }: SummaryCardsProps) {
  const { bestRatio, smallestSize, bestSpeed, bestThroughput, bestDecompSpeed, bestDecompThroughput } = bestValues;

  const cards = [
    { label: 'Best Ratio', value: formatRatio(bestRatio), icon: <TrendingDown className="w-4 h-4 text-blue-500" />, sub: results.find(r => r.compressionRatio === bestRatio)?.algorithm },
    { label: 'Smallest', value: formatBytes(smallestSize), icon: <ArrowDownToLine className="w-4 h-4 text-emerald-500" />, sub: results.find(r => r.compressedSize === smallestSize)?.algorithm },
    { label: 'Fastest Comp', value: formatTime(bestSpeed), icon: <Timer className="w-4 h-4 text-violet-500" />, sub: results.find(r => r.compressTime === bestSpeed)?.algorithm },
    { label: 'Top Comp Thru', value: formatThroughput(bestThroughput), icon: <Zap className="w-4 h-4 text-amber-500" />, sub: results.find(r => r.throughputCompress === bestThroughput)?.algorithm },
    { label: 'Fastest Decomp', value: formatTime(bestDecompSpeed), icon: <Shield className="w-4 h-4 text-pink-500" />, sub: results.find(r => r.decompressTime === bestDecompSpeed)?.algorithm },
    { label: 'Top Decomp Thru', value: formatThroughput(bestDecompThroughput), icon: <Gauge className="w-4 h-4 text-cyan-500" />, sub: results.find(r => r.throughputDecompress === bestDecompThroughput)?.algorithm },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card, i) => (
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
  );
}
