import { useMemo } from 'react';
import {
  SlidersHorizontal, X, Repeat, Zap, Layers, CheckCircle2,
  XCircle, Globe, Code2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { getFamilyColor } from '@/constants';
import { ProviderIcon } from '@/components/ui/ProviderBadge';
import type { AlgorithmConfig, BenchmarkConfig } from '@/types';
import type { QuickSelect } from '@/constants';

interface SettingsPanelProps {
  config: BenchmarkConfig;
  onConfigChange: (c: BenchmarkConfig) => void;
  onClose: () => void;
}

export function SettingsPanel({ config, onConfigChange, onClose }: SettingsPanelProps) {
  const toggleAlgo = (id: string) => {
    onConfigChange({
      ...config,
      algorithms: config.algorithms.map(a =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    });
  };

  const toggleLevel = (id: string, level: number) => {
    onConfigChange({
      ...config,
      algorithms: config.algorithms.map(a => {
        if (a.id !== id) return a;
        const levels = a.levels.includes(level)
          ? a.levels.filter(l => l !== level)
          : [...a.levels, level].sort((x, y) => x - y);
        return { ...a, levels };
      }),
    });
  };

  const setAllLevels = (id: string) => {
    onConfigChange({
      ...config,
      algorithms: config.algorithms.map(a =>
        a.id === id ? { ...a, levels: [...a.availableLevels] } : a
      ),
    });
  };

  const clearLevels = (id: string) => {
    onConfigChange({
      ...config,
      algorithms: config.algorithms.map(a =>
        a.id === id ? { ...a, levels: [] } : a
      ),
    });
  };

  const handleQuickSelect = (mode: QuickSelect) => {
    onConfigChange({
      ...config,
      algorithms: config.algorithms.map(a => {
        switch (mode) {
          case 'all':
            return { ...a, enabled: a.nativeSupported };
          case 'none':
            return { ...a, enabled: false };
          case 'native':
            return { ...a, enabled: a.provider === 'native' && a.nativeSupported };
          case 'js-wasm':
            return { ...a, enabled: a.provider !== 'native' && a.nativeSupported };
        }
      }),
    });
  };

  const quickSelectButtons: { key: QuickSelect; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'all', label: 'All', icon: <CheckCircle2 className="w-3.5 h-3.5" />, desc: 'Enable all available' },
    { key: 'native', label: 'Native Only', icon: <Globe className="w-3.5 h-3.5" />, desc: 'Browser APIs only' },
    { key: 'js-wasm', label: 'JS / WASM', icon: <Code2 className="w-3.5 h-3.5" />, desc: 'Library-based only' },
    { key: 'none', label: 'None', icon: <XCircle className="w-3.5 h-3.5" />, desc: 'Deselect all' },
  ];

  const families = useMemo(() => {
    const fam = new Map<string, AlgorithmConfig[]>();
    for (const a of config.algorithms) {
      const existing = fam.get(a.family) || [];
      existing.push(a);
      fam.set(a.family, existing);
    }
    return Array.from(fam.entries());
  }, [config.algorithms]);

  const enabledCount = config.algorithms.filter(a => a.enabled).length;
  const totalTasks = config.algorithms.filter(a => a.enabled).reduce((sum, a) => sum + (a.supportsLevels ? a.levels.length : 1), 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Benchmark Configuration</h3>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono ml-2">
            {enabledCount} algos · {totalTasks} tasks · {config.iterations}× iter
          </span>
        </div>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Iterations */}
        <div>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center gap-2 mb-2">
            <Repeat className="w-3.5 h-3.5" /> Iterations per benchmark
          </label>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">More iterations = more accurate timing averages.</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[1, 3, 5, 10, 20].map(n => (
              <button
                key={n}
                onClick={() => onConfigChange({ ...config, iterations: n })}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  config.iterations === n
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                )}
              >
                {n}×
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Custom:</span>
              <input
                type="number" min={1} max={100}
                value={config.iterations}
                onChange={e => { const v = parseInt(e.target.value); if (v > 0 && v <= 100) onConfigChange({ ...config, iterations: v }); }}
                className="w-16 px-2 py-1.5 text-xs font-mono text-center border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
          </div>
        </div>

        {/* Quick Select */}
        <div>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5" /> Quick Select
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickSelectButtons.map(btn => (
              <button
                key={btn.key}
                onClick={() => handleQuickSelect(btn.key)}
                className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all group"
              >
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                  {btn.icon}
                  <span className="text-xs font-medium">{btn.label}</span>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{btn.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Algorithms */}
        <div>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center gap-2 mb-3">
            <Layers className="w-3.5 h-3.5" /> Algorithms & Levels
          </label>
          <div className="space-y-4">
            {families.map(([familyName, algos]) => {
              const color = getFamilyColor(familyName);
              const familyLabel = familyName.charAt(0).toUpperCase() + familyName.slice(1);
              return (
                <div key={familyName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", color.dot)} />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">{familyLabel}</span>
                    <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                  {algos.map(algo => (
                    <div
                      key={algo.id}
                      className={cn(
                        "rounded-lg border p-3 transition-all ml-5",
                        algo.enabled ? "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50" : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 opacity-50",
                        !algo.nativeSupported && "opacity-40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => algo.nativeSupported && toggleAlgo(algo.id)}
                            className={cn(
                              "w-8 h-5 rounded-full relative transition-colors shrink-0",
                              !algo.nativeSupported && "cursor-not-allowed",
                              algo.enabled && algo.nativeSupported ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 shadow-sm transition-all",
                              algo.enabled && algo.nativeSupported ? "left-3.5" : "left-0.5"
                            )} />
                          </button>
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{algo.name}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-1",
                            algo.provider === 'native'
                              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : (algo.provider === 'brotli-wasm' || algo.provider === 'zstd-codec')
                                ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                          )}>
                            <ProviderIcon provider={algo.provider} />
                            {algo.provider === 'native' ? 'Native' : algo.provider === 'brotli-wasm' ? 'WASM' : algo.provider === 'zstd-codec' ? 'WASM' : 'JS'}
                          </span>
                          {!algo.nativeSupported && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 font-medium">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                      {algo.enabled && algo.nativeSupported && algo.supportsLevels && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">
                              {algo.family === 'brotli' ? 'Quality' : 'Compression'} Levels ({algo.levels.length}/{algo.availableLevels.length})
                            </span>
                            <div className="flex gap-1">
                              <button onClick={() => setAllLevels(algo.id)} className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">All</button>
                              <button onClick={() => clearLevels(algo.id)} className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">None</button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {algo.availableLevels.map(level => (
                              <button
                                key={level}
                                onClick={() => toggleLevel(algo.id, level)}
                                className={cn(
                                  "w-7 h-7 text-xs font-mono rounded-md border transition-all",
                                  algo.levels.includes(level)
                                    ? cn(color.bar, "text-white border-transparent")
                                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                                )}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
