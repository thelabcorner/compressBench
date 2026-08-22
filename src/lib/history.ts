import { getMany, set, keys, del, delMany } from 'idb-keyval';
import type { BenchmarkHistoryEntry, BenchmarkResult, StoredBenchmarkResult } from '@/types';

const HISTORY_PREFIX = 'bench_';
const MAX_ENTRIES = 50;

function stripBinaryData(result: BenchmarkResult): StoredBenchmarkResult {
  return {
    algorithm: result.algorithm,
    algorithmFamily: result.algorithmFamily,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    compressionRatio: result.compressionRatio,
    compressionLossPct: result.compressionLossPct,
    compressTime: result.compressTime,
    compressTimeMin: result.compressTimeMin,
    compressTimeMax: result.compressTimeMax,
    decompressTime: result.decompressTime,
    decompressTimeMin: result.decompressTimeMin,
    decompressTimeMax: result.decompressTimeMax,
    throughputCompress: result.throughputCompress,
    throughputDecompress: result.throughputDecompress,
    verified: result.verified,
    extension: result.extension,
    level: result.level,
    iterations: result.iterations,
    provider: result.provider,
    providerLabel: result.providerLabel,
  };
}

export async function saveBenchmarkHistory(
  fileName: string,
  fileSize: number,
  fileType: string,
  fileHash: string,
  iterationsUsed: number,
  results: BenchmarkResult[],
): Promise<string> {
  const id = `${HISTORY_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: BenchmarkHistoryEntry = {
    id,
    timestamp: Date.now(),
    fileName,
    fileSize,
    fileType,
    fileHash,
    iterationsUsed,
    results: results.map(stripBinaryData),
  };

  const jsonStr = JSON.stringify(entry);
  const encoded = new TextEncoder().encode(jsonStr);

  let stored: Uint8Array = encoded;
  let compressed = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cs = new CompressionStream('gzip' as any);
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    const readAll = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    })();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writer.write(encoded as any);
    writer.close();
    await readAll;
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    stored = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) { stored.set(chunk, offset); offset += chunk.length; }
    compressed = true;
  } catch {
    // Keep the raw UTF-8 payload when CompressionStream is unavailable.
  }

  // IndexedDB structured-clones typed arrays directly. Keeping the Uint8Array
  // avoids expanding every byte into a boxed JS number via Array.from().
  await set(id, { compressed, data: stored });

  const allKeys = (await keys()).filter(k => typeof k === 'string' && (k as string).startsWith(HISTORY_PREFIX));
  if (allKeys.length > MAX_ENTRIES) {
    const sorted = allKeys.sort();
    const toDelete = sorted.slice(0, allKeys.length - MAX_ENTRIES);
    if (toDelete.length > 0) await delMany(toDelete);
  }

  return id;
}

export async function loadBenchmarkHistory(): Promise<BenchmarkHistoryEntry[]> {
  const allKeys = (await keys()).filter(k => typeof k === 'string' && (k as string).startsWith(HISTORY_PREFIX));
  const entries: BenchmarkHistoryEntry[] = [];
  const rawEntries = await getMany(allKeys);

  for (const raw of rawEntries) {
    try {
      if (!raw) continue;

      let jsonStr: string;
      if (raw.compressed && raw.data) {
        // Backwards compatible with older history entries that stored number[].
        const data = raw.data instanceof Uint8Array ? raw.data : new Uint8Array(raw.data);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ds = new DecompressionStream('gzip' as any);
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          const readAll = (async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
          })();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          writer.write(data as any);
          writer.close();
          await readAll;
          const totalLen = chunks.reduce((s, c) => s + c.length, 0);
          const result = new Uint8Array(totalLen);
          let offset = 0;
          for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
          jsonStr = new TextDecoder().decode(result);
        } catch {
          jsonStr = new TextDecoder().decode(data);
        }
      } else if (raw.data) {
        const data = raw.data instanceof Uint8Array ? raw.data : new Uint8Array(raw.data);
        jsonStr = new TextDecoder().decode(data);
      } else if (typeof raw === 'string') {
        jsonStr = raw;
      } else {
        continue;
      }

      const entry = JSON.parse(jsonStr) as BenchmarkHistoryEntry;
      entries.push(entry);
    } catch {
      // skip corrupted entries
    }
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteBenchmarkEntry(id: string): Promise<void> {
  await del(id);
}

export async function clearAllHistory(): Promise<void> {
  const allKeys = (await keys()).filter(k => typeof k === 'string' && (k as string).startsWith(HISTORY_PREFIX));
  if (allKeys.length > 0) await delMany(allKeys);
}
