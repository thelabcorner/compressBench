import { clear, createStore, delMany, get, set } from 'idb-keyval';

const outputStore = createStore('compressbench-output-cache', 'outputs');

type BenchmarkOutput = Blob | Uint8Array;

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

export async function storeBenchmarkOutput(
  runId: string,
  taskIndex: number,
  output: BenchmarkOutput,
): Promise<string> {
  const key = `${runId}:${taskIndex}`;
  await set(key, toBlob(output), outputStore);
  return key;
}

export async function getBenchmarkOutput(key: string): Promise<Blob | null> {
  const value = await get<Blob>(key, outputStore);
  return value instanceof Blob ? value : null;
}

export async function deleteBenchmarkOutputs(outputKeys: readonly (string | null)[]): Promise<void> {
  const keys = outputKeys.filter((key): key is string => typeof key === 'string');
  if (keys.length > 0) await delMany(keys, outputStore);
}

export async function clearBenchmarkOutputs(): Promise<void> {
  await clear(outputStore);
}
