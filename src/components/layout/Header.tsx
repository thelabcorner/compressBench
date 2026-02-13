import {
  FileArchive, History, Settings2, Play, RotateCcw, Sun, Moon, Monitor,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Theme, BenchmarkStatus } from '@/types';

interface HeaderProps {
  theme: Theme;
  setTheme: (t: Theme) => void;
  status: BenchmarkStatus;
  showHistory: boolean;
  showSettings: boolean;
  hasFile: boolean;
  onToggleHistory: () => void;
  onToggleSettings: () => void;
  onRerun: () => void;
  onReset: () => void;
}

const themeOptions: Array<{ value: Theme; icon: React.ReactNode; label: string }> = [
  { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
  { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
  { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
];

export function Header({
  theme, setTheme, status, showHistory, showSettings, hasFile,
  onToggleHistory, onToggleSettings, onRerun, onReset,
}: HeaderProps) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100">
              <FileArchive className="w-4 h-4 text-white dark:text-zinc-900" />
            </div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">CompressBench</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleHistory}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors",
                showHistory
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>
            {hasFile && status === 'complete' && (
              <>
                <button
                  onClick={onToggleSettings}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors",
                    showSettings ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Config</span>
                </button>
                <button onClick={onRerun} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                  <Play className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Re-run</span>
                </button>
                <button onClick={onReset} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New</span>
                </button>
              </>
            )}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 ml-1">
              {themeOptions.map(opt => (
                <button key={opt.value} onClick={() => setTheme(opt.value)} title={opt.label}
                  className={cn("p-1.5 rounded-md transition-all duration-200",
                    theme === opt.value ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                  )}>{opt.icon}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
