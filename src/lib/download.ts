import { getBenchmarkOutput } from '@/lib/outputStore';
import type { BenchmarkResult } from '@/types';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

export async function downloadStoredOutput(outputKey: string | null, filename: string): Promise<boolean> {
  if (!outputKey) return false;
  const blob = await getBenchmarkOutput(outputKey);
  if (!blob) return false;
  triggerBlobDownload(blob, filename);
  return true;
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
