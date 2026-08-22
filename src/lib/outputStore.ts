import { clear, createStore, delMany, get, set } from 'idb-keyval';

const outputStore = createStore('compressbench-output-cache', 'outputs');
const DELETE_BATCH_SIZE = 512;

type BenchmarkOutput = Blob | Uint8Array;

interface ChunkManifest {
  kind: 'chunked';
  version: 1;
  size: number;
  chunkKeys: string[];
}

type StoredOutput = Blob | ChunkManifest;

function toBlob(output: BenchmarkOutput): Blob {
  if (output instanceof Blob) return output;

  const buffer = output.buffer;
  if (
    buffer instanceof ArrayBuffer &&
    output.byteOffset === 0 &&
    output.byteLength === buffer.byteLength
  ) {
    return new Blob([buffer], { type: 'application/octet-stream' });
  }

  return new Blob([Uint8Array.from(output).buffer], { type: 'application/octet-stream' });
}

function isChunkManifest(value: unknown): value is ChunkManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ChunkManifest>;
  return (
    candidate.kind === 'chunked' &&
    candidate.version === 1 &&
    typeof candidate.size === 'number' &&
    Array.isArray(candidate.chunkKeys) &&
    candidate.chunkKeys.every(key => typeof key === 'string')
  );
}

async function deleteKeys(keys: readonly string[]): Promise<void> {
  for (let offset = 0; offset < keys.length; offset += DELETE_BATCH_SIZE) {
    await delMany(keys.slice(offset, offset + DELETE_BATCH_SIZE), outputStore);
  }
}

async function* streamBlob(blob: Blob, signal?: AbortSignal): AsyncGenerator<Uint8Array> {
  const reader = blob.stream().getReader();
  try {
    while (true) {
      if (signal?.aborted) {
        if (signal.reason instanceof Error) throw signal.reason;
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value.length > 0) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export interface BenchmarkOutputWriter {
  readonly key: string;
  readonly size: number;
  write(output: BenchmarkOutput): Promise<void>;
  close(): Promise<string>;
  abort(): Promise<void>;
}

export function createBenchmarkOutputWriter(runId: string, taskIndex: number): BenchmarkOutputWriter {
  const key = `${runId}:${taskIndex}`;
  const chunkKeys: string[] = [];
  let totalSize = 0;
  let nextChunk = 0;
  let closed = false;

  return {
    get key() {
      return key;
    },
    get size() {
      return totalSize;
    },
    async write(output: BenchmarkOutput) {
      if (closed) throw new Error('Benchmark output writer is already closed');
      const blob = toBlob(output);
      if (blob.size === 0) return;
      const chunkKey = `${key}:chunk:${nextChunk++}`;
      await set(chunkKey, blob, outputStore);
      chunkKeys.push(chunkKey);
      totalSize += blob.size;
    },
    async close() {
      if (!closed) {
        const manifest: ChunkManifest = {
          kind: 'chunked',
          version: 1,
          size: totalSize,
          chunkKeys: [...chunkKeys],
        };
        await set(key, manifest, outputStore);
        closed = true;
      }
      return key;
    },
    async abort() {
      closed = true;
      await deleteKeys([...chunkKeys, key]);
    },
  };
}

export async function storeBenchmarkOutput(
  runId: string,
  taskIndex: number,
  output: BenchmarkOutput,
): Promise<string> {
  const key = `${runId}:${taskIndex}`;
  await set(key, toBlob(output), outputStore);
  return key;
}

export async function* readBenchmarkOutputChunks(
  key: string,
  signal?: AbortSignal,
): AsyncGenerator<Uint8Array> {
  const value = await get<StoredOutput>(key, outputStore);

  if (value instanceof Blob) {
    yield* streamBlob(value, signal);
    return;
  }

  if (!isChunkManifest(value)) {
    throw new Error('Compressed benchmark output is missing');
  }

  for (const chunkKey of value.chunkKeys) {
    if (signal?.aborted) {
      if (signal.reason instanceof Error) throw signal.reason;
      throw new DOMException('Operation cancelled', 'AbortError');
    }
    const chunk = await get<Blob>(chunkKey, outputStore);
    if (!(chunk instanceof Blob)) throw new Error('Compressed benchmark output chunk is missing');
    yield* streamBlob(chunk, signal);
  }
}

export async function getBenchmarkOutput(key: string): Promise<Blob | null> {
  const value = await get<StoredOutput>(key, outputStore);
  if (value instanceof Blob) return value;
  if (!isChunkManifest(value)) return null;

  const parts: Blob[] = [];
  for (const chunkKey of value.chunkKeys) {
    const chunk = await get<Blob>(chunkKey, outputStore);
    if (!(chunk instanceof Blob)) return null;
    parts.push(chunk);
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}

export async function deleteBenchmarkOutputs(outputKeys: readonly (string | null)[]): Promise<void> {
  const keys = outputKeys.filter((key): key is string => typeof key === 'string');
  if (keys.length === 0) return;

  const keysToDelete: string[] = [];
  for (const key of keys) {
    const value = await get<StoredOutput>(key, outputStore);
    keysToDelete.push(key);
    if (isChunkManifest(value)) keysToDelete.push(...value.chunkKeys);
  }

  await deleteKeys(keysToDelete);
}

export async function clearBenchmarkOutputs(): Promise<void> {
  await clear(outputStore);
}
