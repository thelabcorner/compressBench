import { Gauge, XCircle } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import type { BenchmarkStatus, FileInfo } from '@/types';

interface ProgressProps {
  status: BenchmarkStatus;
  file: FileInfo | null;
  iterations: number;
  progress: { current: number; total: number; name: string };
  error: string | null;
  onReset: () => void;
}

export function BenchmarkProgress({ status, file, iterations, progress, error, onReset }: ProgressProps) {
  if (status === 'error') {
    return (
      <div className="animate-fade-in">
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900 rounded-xl p-8 text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Benchmark Failed</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button onClick={onReset} className="mt-4 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 sm:p-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center animate-pulse-subtle">
            <Gauge className="w-7 h-7 text-white dark:text-zinc-900" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {status === 'loading' ? 'Reading file & computing hash...' : 'Running benchmarks...'}
            </h3>
            {file && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {file.name} · {formatBytes(file.size)} · {iterations}× iterations
              </p>
            )}
          </div>
          {status === 'running' && (
            <div className="w-full max-w-md space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs truncate max-w-[200px]">{progress.name}</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium tabular-nums">{progress.current}/{progress.total}</span>
              </div>
              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
