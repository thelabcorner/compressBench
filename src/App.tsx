import {
  Zap, BarChart3, History as HistoryIcon, Settings2, Play,
  ChevronRight, Info,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/hooks/useTheme';
import { useBenchmark } from '@/hooks/useBenchmark';

// Layout
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

// Components
import { BrowserSupportBadges } from '@/components/BrowserSupportBadges';
import { UploadZone } from '@/components/UploadZone';
import { BenchmarkProgress } from '@/components/BenchmarkProgress';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { HistoryDetailView } from '@/components/history/HistoryDetailView';

// Results
import { SummaryCards } from '@/components/results/SummaryCards';
import { ComparisonChart } from '@/components/results/ComparisonChart';
import { DownloadBestPerFamily } from '@/components/results/DownloadBestPerFamily';
import { FileInfoCard } from '@/components/results/FileInfoCard';
import { ResultsTable } from '@/components/results/ResultsTable';
import { DetailPanel } from '@/components/results/DetailPanel';

export function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const bench = useBenchmark();

  if (!bench.config) return null;

  // ─── History Detail View ───
  if (bench.viewingHistory) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
        <Header
          theme={theme} setTheme={setTheme}
          status={bench.status} hasFile={!!bench.file}
          showHistory={false} showSettings={false}
          onToggleHistory={() => { bench.setViewingHistory(null); bench.setShowHistory(true); }}
          onToggleSettings={() => {}}
          onRerun={bench.handleRerun}
          onReset={bench.handleReset}
        />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <HistoryDetailView
            entry={bench.viewingHistory}
            onClose={() => { bench.setViewingHistory(null); bench.setShowHistory(true); }}
            isDark={isDark}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      <Header
        theme={theme} setTheme={setTheme}
        status={bench.status} hasFile={!!bench.file}
        showHistory={bench.showHistory}
        showSettings={bench.showSettings}
        onToggleHistory={() => { bench.setShowHistory(h => !h); bench.setShowSettings(false); }}
        onToggleSettings={() => { bench.setShowSettings(s => !s); bench.setShowHistory(false); }}
        onRerun={bench.handleRerun}
        onReset={bench.handleReset}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* History Panel */}
        {bench.showHistory && (
          <div className="mb-6 animate-slide-up">
            <HistoryPanel
              onClose={() => bench.setShowHistory(false)}
              onViewEntry={(entry) => { bench.setViewingHistory(entry); bench.setShowHistory(false); }}
            />
          </div>
        )}

        {/* ─── IDLE STATE ─── */}
        {bench.status === 'idle' && !bench.showHistory && (
          <div className="animate-fade-in space-y-8">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Benchmark Compression Algorithms
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto text-sm">
                Upload any file to test native browser APIs and JS/WASM libraries side-by-side.
                Compare compression & decompression speed, ratio, throughput — and download outputs.
              </p>
            </div>

            {/* Settings toggle */}
            <div className="flex justify-center">
              <button
                onClick={() => bench.setShowSettings(s => !s)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all",
                  bench.showSettings
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                )}
              >
                <Settings2 className="w-4 h-4" />
                Configure Benchmarks
                <span className="text-xs opacity-60">({bench.enabledCount} algos · {bench.totalTasks} tasks · {bench.config.iterations}× iter)</span>
                <ChevronRight className={cn("w-4 h-4 transition-transform", bench.showSettings && "rotate-90")} />
              </button>
            </div>

            {bench.showSettings && (
              <div className="animate-slide-up">
                <SettingsPanel config={bench.config} onConfigChange={bench.setConfig} onClose={() => bench.setShowSettings(false)} />
              </div>
            )}

            {/* Upload area */}
            <UploadZone
              isDragging={bench.isDragging}
              fileInputRef={bench.fileInputRef}
              onDrop={bench.handleDrop}
              onDragOver={bench.handleDragOver}
              onDragLeave={bench.handleDragLeave}
              onFileSelect={bench.handleFile}
            />

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Zap className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />, bg: 'bg-blue-50 dark:bg-blue-950', title: 'Native + JS + WASM', desc: 'Gzip, Deflate, Brotli, Zstandard — native APIs vs fflate, brotli-wasm, zstd-codec' },
                { icon: <BarChart3 className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />, bg: 'bg-violet-50 dark:bg-violet-950', title: 'Comp + Decomp Benchmarks', desc: 'Full compress & decompress timing with min/avg/max and file hash verification' },
                { icon: <HistoryIcon className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />, bg: 'bg-emerald-50 dark:bg-emerald-950', title: 'History & Export', desc: 'Auto-saved benchmark history in IndexedDB. Download .gz, .br, .deflate, .zst outputs' },
              ].map((card, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", card.bg)}>{card.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{card.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Browser capabilities */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wider">Browser Algorithm Support</span>
              <BrowserSupportBadges algorithms={bench.config.algorithms} />
            </div>
          </div>
        )}

        {/* ─── LOADING / RUNNING / ERROR ─── */}
        {(bench.status === 'loading' || bench.status === 'running' || bench.status === 'error') && (
          <BenchmarkProgress
            status={bench.status}
            file={bench.file}
            iterations={bench.config.iterations}
            progress={bench.progress}
            error={bench.error}
            onReset={bench.handleReset}
          />
        )}

        {/* ─── RESULTS ─── */}
        {bench.status === 'complete' && bench.file && !bench.showHistory && (
          <div className="space-y-5 animate-fade-in">
            {/* Settings Panel */}
            {bench.showSettings && (
              <div className="animate-slide-up">
                <SettingsPanel config={bench.config} onConfigChange={bench.setConfig} onClose={() => bench.setShowSettings(false)} />
                <div className="mt-3 flex justify-center">
                  <button onClick={bench.handleRerun} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
                    <Play className="w-4 h-4" /> Re-run with new configuration
                  </button>
                </div>
              </div>
            )}

            <FileInfoCard
              file={bench.file}
              resultCount={bench.results.length}
              iterations={bench.config.iterations}
              algorithms={bench.config.algorithms}
            />

            <SummaryCards results={bench.results} bestValues={bench.bestValues} />

            <ComparisonChart
              results={bench.results}
              chartSortedResults={bench.chartSortedResults}
              chartMetric={bench.chartMetric}
              chartSort={bench.chartSort}
              onMetricChange={bench.setChartMetric}
              onSortChange={bench.setChartSort}
            />

            <DownloadBestPerFamily
              bestPerFamily={bench.bestPerFamily}
              fileName={bench.file.name}
            />

            <ResultsTable
              sortedResults={bench.sortedResults}
              fileName={bench.file.name}
              iterations={bench.config.iterations}
              isDark={isDark}
              sortBy={bench.sortBy}
              sortDir={bench.sortDir}
              expandedRow={bench.expandedRow}
              bestValues={bench.bestValues}
              onSort={bench.handleSort}
              onExpandRow={bench.setExpandedRow}
            />

            {/* Expanded Detail Panel */}
            {bench.expandedRow !== null && bench.sortedResults[bench.expandedRow] && (
              <DetailPanel
                result={bench.sortedResults[bench.expandedRow]}
                fileName={bench.file.name}
                isDark={isDark}
                onClose={() => bench.setExpandedRow(null)}
              />
            )}

            {/* Info Footer */}
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Info className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                All algorithms run both <strong className="text-zinc-600 dark:text-zinc-300">natively</strong> and via{' '}
                <strong className="text-zinc-600 dark:text-zinc-300">JS/WASM libraries</strong> (fflate, brotli-wasm, zstd-codec).
                Each benchmark runs {bench.config.iterations}× iterations — results show averages with min/max in detail view.
                File integrity verified via round-trip decompress. SHA-256 hash computed on upload.
                Results auto-saved to IndexedDB (compressed, without file data).
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
