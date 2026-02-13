import { ChevronDown, ChevronUp } from 'lucide-react';

export function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: 'asc' | 'desc' }) {
  if (sortBy !== col) return <ChevronDown className="w-3 h-3 text-zinc-400 dark:text-zinc-600" />;
  return sortDir === 'desc'
    ? <ChevronDown className="w-3 h-3 text-zinc-900 dark:text-zinc-100" />
    : <ChevronUp className="w-3 h-3 text-zinc-900 dark:text-zinc-100" />;
}
