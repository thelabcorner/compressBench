export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatTime(ms: number): string {
  if (ms < 0.001) return '< 1 μs';
  if (ms < 1) return `${(ms * 1000).toFixed(1)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatThroughput(mbps: number): string {
  if (!isFinite(mbps) || isNaN(mbps)) return '∞';
  if (mbps >= 1024) return `${(mbps / 1024).toFixed(1)} GB/s`;
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`;
  return `${(mbps * 1024).toFixed(1)} KB/s`;
}

export function formatRatio(ratio: number): string {
  if (!isFinite(ratio) || isNaN(ratio)) return 'N/A';
  return `${ratio.toFixed(2)}x`;
}

export function formatPercent(pct: number): string {
  if (!isFinite(pct) || isNaN(pct)) return 'N/A';
  return `${pct.toFixed(1)}%`;
}

export function formatTimeRange(min: number, max: number): string {
  return `${formatTime(min)} – ${formatTime(max)}`;
}
