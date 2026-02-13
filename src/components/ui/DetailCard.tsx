export function DetailCard({ label, value, subValue, icon }: { label: string; value: string; subValue?: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
      <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">{value}</p>
      {subValue && <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{subValue}</p>}
    </div>
  );
}
