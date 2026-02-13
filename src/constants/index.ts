import type { ChartMetric, ChartSort } from '@/types';
import {
  Percent, Zap, Clock, Ruler, Timer, Gauge,
  ArrowDownAZ, Layers, ArrowUpDown,
} from 'lucide-react';
import { createElement } from 'react';

// ─── Family Colors ───

export const FAMILY_COLORS: Record<string, { bar: string; badge: string; badgeDark: string; dot: string }> = {
  gzip: { bar: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200', badgeDark: 'bg-blue-950 text-blue-300 border-blue-800', dot: 'bg-blue-500' },
  deflate: { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200', badgeDark: 'bg-violet-950 text-violet-300 border-violet-800', dot: 'bg-violet-500' },
  'deflate-raw': { bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200', badgeDark: 'bg-orange-950 text-orange-300 border-orange-800', dot: 'bg-orange-500' },
  zlib: { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 border-rose-200', badgeDark: 'bg-rose-950 text-rose-300 border-rose-800', dot: 'bg-rose-500' },
  brotli: { bar: 'bg-pink-500', badge: 'bg-pink-50 text-pink-700 border-pink-200', badgeDark: 'bg-pink-950 text-pink-300 border-pink-800', dot: 'bg-pink-500' },
  zstd: { bar: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', badgeDark: 'bg-cyan-950 text-cyan-300 border-cyan-800', dot: 'bg-cyan-500' },
};

export function getFamilyColor(family: string) {
  return FAMILY_COLORS[family] || { bar: 'bg-zinc-500', badge: 'bg-zinc-50 text-zinc-700 border-zinc-200', badgeDark: 'bg-zinc-800 text-zinc-300 border-zinc-700', dot: 'bg-zinc-500' };
}

// ─── Provider styling ───

export function getProviderBadgeClass(provider: string, isDark: boolean): string {
  if (provider === 'native') return isDark ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (provider === 'brotli-wasm') return isDark ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200';
  if (provider === 'zstd-codec') return isDark ? 'bg-teal-950 text-teal-300 border-teal-800' : 'bg-teal-50 text-teal-700 border-teal-200';
  return isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

// ─── Chart Metrics ───

export const CHART_METRICS: { key: ChartMetric; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { key: 'pctSaved', label: '% Saved', shortLabel: '%', icon: createElement(Percent, { className: 'w-3.5 h-3.5' }) },
  { key: 'throughput', label: 'Comp. Throughput', shortLabel: 'Thru', icon: createElement(Zap, { className: 'w-3.5 h-3.5' }) },
  { key: 'compressTime', label: 'Compress Time', shortLabel: 'Time', icon: createElement(Clock, { className: 'w-3.5 h-3.5' }) },
  { key: 'compressedSize', label: 'Compressed Size', shortLabel: 'Size', icon: createElement(Ruler, { className: 'w-3.5 h-3.5' }) },
  { key: 'decompressTime', label: 'Decompress Time', shortLabel: 'Decomp', icon: createElement(Timer, { className: 'w-3.5 h-3.5' }) },
  { key: 'decompressThroughput', label: 'Decomp. Throughput', shortLabel: 'D.Thru', icon: createElement(Gauge, { className: 'w-3.5 h-3.5' }) },
];

// ─── Chart Sorts ───

export const CHART_SORTS: { key: ChartSort; label: string; icon: React.ReactNode }[] = [
  { key: 'name', label: 'Name', icon: createElement(ArrowDownAZ, { className: 'w-3.5 h-3.5' }) },
  { key: 'family', label: 'Family', icon: createElement(Layers, { className: 'w-3.5 h-3.5' }) },
  { key: 'value', label: 'Value', icon: createElement(ArrowUpDown, { className: 'w-3.5 h-3.5' }) },
];

// ─── Quick select type ───

export type QuickSelect = 'all' | 'none' | 'native' | 'js-wasm';
