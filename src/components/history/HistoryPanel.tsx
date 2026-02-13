import { useState, useEffect } from 'react';
import { History, Trash2, X, Eye, Hash, HardDrive } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes, formatRatio } from '@/lib/format';
import { loadBenchmarkHistory, deleteBenchmarkEntry, clearAllHistory } from '@/lib/history';
import type { BenchmarkHistoryEntry } from '@/types';

interface HistoryPanelProps {
  onClose: () => void;
  onViewEntry: (entry: BenchmarkHistoryEntry) => void;
}

export function HistoryPanel({ onClose, onViewEntry }: HistoryPanelProps) {
  const [entries, setEntries] = useState<BenchmarkHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBenchmarkHistory().then(e => { setEntries(e); setLoading(false); });
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteBenchmarkEntry(id);
    setEntries(prev => prev.filter(en => en.id !== id));
  };

  const handleClearAll = async () => {
    await clearAllHistory();
    setEntries([]);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Benchmark History</h3>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{entries.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button onClick={handleClearAll} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-colors">
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          )}
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <div className="p-8 text-center text-sm text-zinc-400 dark:text-zinc-500">Loading history...</div>
        )}
        {!loading && entries.length === 0 && (
          <div className="p-8 text-center">
            <History className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No benchmark history yet</p>
            <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">Results are automatically saved after each run</p>
          </div>
        )}
        {entries.map(entry => {
          const bestRatio = Math.max(...entry.results.map(r => r.compressionRatio));
          const bestAlgo = entry.results.find(r => r.compressionRatio === bestRatio);
          return (
            <div
              key={entry.id}
              onClick={() => onViewEntry(entry)}
              className="flex items-center justify-between px-5 py-3 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{entry.fileName}</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{formatBytes(entry.fileSize)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-5.5">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{entry.results.length} benchmarks</span>
                  <span className="text-[10px] text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{entry.iterationsUsed}× iter</span>
                  {bestAlgo && (
                    <>
                      <span className="text-[10px] text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Best: {formatRatio(bestRatio)} ({bestAlgo.algorithm})</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1 ml-5.5">
                  <Hash className="w-2.5 h-2.5 text-zinc-300 dark:text-zinc-600" />
                  <span className="text-[9px] font-mono text-zinc-300 dark:text-zinc-600 truncate max-w-[200px]">{entry.fileHash}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <Eye className={cn("w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors")} />
                <button
                  onClick={(e) => handleDelete(entry.id, e)}
                  className="p-1 text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
