import type { BenchmarkResult } from '@/types';

export function downloadBlob(data: Uint8Array, filename: string) {
  // Create a proper copy of the data to ensure it's a standard Uint8Array
  const copy = new Uint8Array(data.length);
  copy.set(data);
  const blob = new Blob([copy], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Append to DOM — required by some browsers/sandboxed environments
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay revocation to ensure browser has time to initiate the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

export function getBestPerFamily(results: BenchmarkResult[]): BenchmarkResult[] {
  const familyMap = new Map<string, BenchmarkResult>();
  for (const r of results) {
    const key = r.algorithmFamily;
    const existing = familyMap.get(key);
    if (!existing || r.compressionRatio > existing.compressionRatio) {
      familyMap.set(key, r);
    }
  }
  return Array.from(familyMap.values()).sort((a, b) => b.compressionRatio - a.compressionRatio);
}
