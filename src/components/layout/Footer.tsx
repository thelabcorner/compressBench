export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          <p>CompressBench — Client-side compression benchmarking tool</p>
          <p>No data leaves your browser · Native APIs + fflate + brotli-wasm + zstd-codec</p>
        </div>
      </div>
    </footer>
  );
}
