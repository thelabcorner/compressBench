import type { BenchmarkResult } from '@/types';

function getExactArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = data.buffer;

  // The benchmark outputs normally own their entire ArrayBuffer. In that case
  // we can hand the backing buffer straight to Blob without allocating and
  // copying the whole compressed payload again.
  if (
    buffer instanceof ArrayBuffer &&
    data.byteOffset === 0 &&
    data.byteLength === buffer.byteLength
  ) {
    return buffer;
  }

  // WASM codecs may return a view into a larger linear-memory buffer. Copy only
  // for those subarray/shared-buffer cases so the download contains exact bytes
  // without pinning or exposing the entire WASM heap.
  return Uint8Array.from(data).buffer;
}

export function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([getExactArrayBuffer(data)], { type: 'application/octet-stream' });
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
