const SHA256_BLOCK_SIZE = 64;
const FILE_HASH_CHUNK_SIZE = 4 * 1024 * 1024;
const WEB_CRYPTO_HASH_LIMIT = 32 * 1024 * 1024;

const SHA256_INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException('Operation cancelled', 'AbortError');
}

export class Sha256 {
  private readonly state = new Uint32Array(SHA256_INITIAL);
  private readonly buffer = new Uint8Array(SHA256_BLOCK_SIZE);
  private readonly words = new Uint32Array(64);
  private bufferLength = 0;
  private bytesHashed = 0;
  private finished = false;

  update(data: Uint8Array): this {
    if (this.finished) throw new Error('SHA-256 digest has already been finalized');
    if (data.length === 0) return this;

    this.bytesHashed += data.length;
    let offset = 0;

    if (this.bufferLength > 0) {
      const needed = SHA256_BLOCK_SIZE - this.bufferLength;
      const take = Math.min(needed, data.length);
      this.buffer.set(data.subarray(0, take), this.bufferLength);
      this.bufferLength += take;
      offset += take;

      if (this.bufferLength === SHA256_BLOCK_SIZE) {
        this.processBlock(this.buffer, 0);
        this.bufferLength = 0;
      }
    }

    while (offset + SHA256_BLOCK_SIZE <= data.length) {
      this.processBlock(data, offset);
      offset += SHA256_BLOCK_SIZE;
    }

    if (offset < data.length) {
      this.buffer.set(data.subarray(offset), 0);
      this.bufferLength = data.length - offset;
    }

    return this;
  }

  digest(): Uint8Array {
    if (!this.finished) this.finish();

    const output = new Uint8Array(32);
    for (let i = 0; i < this.state.length; i++) {
      const value = this.state[i];
      const offset = i * 4;
      output[offset] = value >>> 24;
      output[offset + 1] = value >>> 16;
      output[offset + 2] = value >>> 8;
      output[offset + 3] = value;
    }
    return output;
  }

  digestHex(): string {
    const digest = this.digest();
    let hex = '';
    for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
    return hex;
  }

  private finish(): void {
    const bytesHashed = this.bytesHashed;
    this.buffer[this.bufferLength++] = 0x80;

    if (this.bufferLength > 56) {
      this.buffer.fill(0, this.bufferLength, SHA256_BLOCK_SIZE);
      this.processBlock(this.buffer, 0);
      this.bufferLength = 0;
    }

    this.buffer.fill(0, this.bufferLength, 56);

    const bitLengthHigh = Math.floor(bytesHashed / 0x20000000) >>> 0;
    const bitLengthLow = ((bytesHashed % 0x20000000) * 8) >>> 0;

    this.buffer[56] = bitLengthHigh >>> 24;
    this.buffer[57] = bitLengthHigh >>> 16;
    this.buffer[58] = bitLengthHigh >>> 8;
    this.buffer[59] = bitLengthHigh;
    this.buffer[60] = bitLengthLow >>> 24;
    this.buffer[61] = bitLengthLow >>> 16;
    this.buffer[62] = bitLengthLow >>> 8;
    this.buffer[63] = bitLengthLow;

    this.processBlock(this.buffer, 0);
    this.bufferLength = 0;
    this.finished = true;
  }

  private processBlock(data: Uint8Array, offset: number): void {
    const w = this.words;

    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = (
        (data[j] << 24) |
        (data[j + 1] << 16) |
        (data[j + 2] << 8) |
        data[j + 3]
      ) >>> 0;
    }

    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + sigma0 + w[i - 7] + sigma1) >>> 0;
    }

    let a = this.state[0];
    let b = this.state[1];
    let c = this.state[2];
    let d = this.state[3];
    let e = this.state[4];
    let f = this.state[5];
    let g = this.state[6];
    let h = this.state[7];

    for (let i = 0; i < 64; i++) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + sigma1 + choice + SHA256_K[i] + w[i]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    this.state[0] = (this.state[0] + a) >>> 0;
    this.state[1] = (this.state[1] + b) >>> 0;
    this.state[2] = (this.state[2] + c) >>> 0;
    this.state[3] = (this.state[3] + d) >>> 0;
    this.state[4] = (this.state[4] + e) >>> 0;
    this.state[5] = (this.state[5] + f) >>> 0;
    this.state[6] = (this.state[6] + g) >>> 0;
    this.state[7] = (this.state[7] + h) >>> 0;
  }
}

export async function computeSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (const byte of hashArray) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export async function computeFileSHA256(
  file: File,
  signal?: AbortSignal,
  chunkSize = FILE_HASH_CHUNK_SIZE,
): Promise<string> {
  throwIfAborted(signal);

  if (file.size <= WEB_CRYPTO_HASH_LIMIT) {
    const data = new Uint8Array(await file.arrayBuffer());
    throwIfAborted(signal);
    return computeSHA256(data);
  }

  const hasher = new Sha256();
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    throwIfAborted(signal);
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    throwIfAborted(signal);
    hasher.update(chunk);
  }

  return hasher.digestHex();
}
