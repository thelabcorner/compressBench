import { Globe, Code2, Cpu } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getFamilyColor } from '@/constants';
import type { AlgorithmConfig } from '@/types';

const FAMILIES = [
  { name: 'Gzip', id: 'gzip' },
  { name: 'Deflate', id: 'deflate' },
  { name: 'Deflate-Raw', id: 'deflate-raw' },
  { name: 'Zlib', id: 'zlib' },
  { name: 'Brotli', id: 'brotli' },
  { name: 'Zstandard', id: 'zstd' },
];

export function BrowserSupportBadges({ algorithms }: { algorithms: AlgorithmConfig[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FAMILIES.map(fam => {
        const algos = algorithms.filter(a => a.family === fam.id);
        if (algos.length === 0) return null;
        const nativeAlgo = algos.find(a => a.provider === 'native');
        const jsAlgos = algos.filter(a => a.provider !== 'native');
        const hasNative = nativeAlgo?.nativeSupported ?? false;

        return (
          <div key={fam.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <div className={cn("w-2 h-2 rounded-full", getFamilyColor(fam.id).dot)} />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{fam.name}</span>
            <div className="flex items-center gap-1 ml-0.5">
              {nativeAlgo && (
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded font-medium inline-flex items-center gap-0.5",
                  hasNative ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950 text-red-500 dark:text-red-400"
                )}>
                  <Globe className="w-2.5 h-2.5" /> {hasNative ? '✓' : '✗'}
                </span>
              )}
              {jsAlgos.map(jsAlgo => (
                <span key={jsAlgo.id} className={cn(
                  "text-[9px] px-1 py-0.5 rounded font-medium inline-flex items-center gap-0.5",
                  jsAlgo.nativeSupported ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950 text-red-500 dark:text-red-400"
                )}>
                  {jsAlgo.provider === 'brotli-wasm' || jsAlgo.provider === 'zstd-codec' ? <Cpu className="w-2.5 h-2.5" /> : <Code2 className="w-2.5 h-2.5" />}
                  {jsAlgo.nativeSupported ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
