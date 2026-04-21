// Share code format v1
// Prefix: "WE1u" (uncompressed) or "WE1c" (deflate-raw compressed)
// Body bytes: [0x01 version][varint entries…][xor checksum]
//   each entry: varint((delta << 2) | state) where state ∈ {1:played, 2:wish, 3:both}
// Body is then optionally deflated, and Base62-encoded (with a leading 0x01 sentinel
// byte so that leading zero bytes in the payload survive the BigInt round-trip).

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const VERSION = 0x01;
const PREFIX_RAW = 'WE1u';
const PREFIX_DEFLATE = 'WE1c';

export interface ShareData {
  played: string[];
  wish: string[];
}

function buildStateMap({ played, wish }: ShareData): Map<number, number> {
  const m = new Map<number, number>();
  const add = (id: string, bit: 1 | 2) => {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 0) return;
    m.set(n, (m.get(n) ?? 0) | bit);
  };
  for (const id of played) add(id, 1);
  for (const id of wish) add(id, 2);
  return m;
}

function writeVarint(out: number[], value: number): void {
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
}

function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let off = offset;
  while (true) {
    if (off >= buf.length) throw new Error('코드 형식 오류 (varint 중단)');
    const b = buf[off++];
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) throw new Error('코드 형식 오류 (varint 초과)');
  }
  return [value >>> 0, off];
}

function xorChecksum(buf: Uint8Array): number {
  let x = 0;
  for (const b of buf) x ^= b;
  return x & 0xff;
}

function buildPayload(map: Map<number, number>): Uint8Array {
  const ids = [...map.keys()].sort((a, b) => a - b);
  const entries: number[] = [];
  let prev = 0;
  for (const id of ids) {
    const state = map.get(id)!;
    if (state === 0) continue;
    const delta = id - prev;
    writeVarint(entries, (delta << 2) | state);
    prev = id;
  }
  const out = new Uint8Array(1 + entries.length + 1);
  out[0] = VERSION;
  out.set(entries, 1);
  out[out.length - 1] = xorChecksum(out.subarray(0, out.length - 1));
  return out;
}

function parsePayload(bytes: Uint8Array): ShareData {
  if (bytes.length < 2) throw new Error('코드가 너무 짧습니다');
  if (bytes[0] !== VERSION) throw new Error(`지원하지 않는 버전(${bytes[0]})입니다`);
  const expected = bytes[bytes.length - 1];
  const actual = xorChecksum(bytes.subarray(0, bytes.length - 1));
  if (expected !== actual) throw new Error('체크섬 불일치 — 코드가 손상되었습니다');
  const body = bytes.subarray(1, bytes.length - 1);
  const played: string[] = [];
  const wish: string[] = [];
  let off = 0;
  let prev = 0;
  while (off < body.length) {
    const [val, next] = readVarint(body, off);
    off = next;
    const state = val & 0x3;
    const delta = val >>> 2;
    if (state === 0) throw new Error('잘못된 상태 플래그');
    const id = prev + delta;
    if (state & 1) played.push(String(id));
    if (state & 2) wish.push(String(id));
    prev = id;
  }
  return { played, wish };
}

// ---------- Base62 (BigInt-based, with 0x01 sentinel prefix) ----------
function bytesToBase62(bytes: Uint8Array): string {
  const padded = new Uint8Array(bytes.length + 1);
  padded[0] = 0x01;
  padded.set(bytes, 1);
  let n = 0n;
  for (const b of padded) n = (n << 8n) | BigInt(b);
  if (n === 0n) return '0';
  let out = '';
  while (n > 0n) {
    const r = Number(n % 62n);
    out = BASE62[r] + out;
    n /= 62n;
  }
  return out;
}

function base62ToBytes(s: string): Uint8Array {
  if (!s) throw new Error('빈 코드');
  let n = 0n;
  for (const ch of s) {
    const idx = BASE62.indexOf(ch);
    if (idx < 0) throw new Error(`허용되지 않는 문자: ${ch}`);
    n = n * 62n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  bytes.reverse();
  if (bytes.length === 0 || bytes[0] !== 0x01) throw new Error('코드 형식 오류 (헤더)');
  return new Uint8Array(bytes.slice(1));
}

// ---------- Deflate (browser CompressionStream, graceful fallback) ----------
function toBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy]);
}

async function tryDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = toBlob(bytes)
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw' as CompressionFormat));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다');
  }
  const stream = toBlob(bytes)
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

// ---------- Public API ----------
export async function encodeShareCode(data: ShareData): Promise<string> {
  const map = buildStateMap(data);
  const raw = buildPayload(map);
  const rawStr = PREFIX_RAW + bytesToBase62(raw);

  const deflated = await tryDeflate(raw);
  if (!deflated) return rawStr;
  const defStr = PREFIX_DEFLATE + bytesToBase62(deflated);
  return defStr.length < rawStr.length ? defStr : rawStr;
}

export async function decodeShareCode(input: string): Promise<ShareData> {
  const code = input.trim().replace(/\s+/g, '');
  if (code.startsWith(PREFIX_DEFLATE)) {
    const compressed = base62ToBytes(code.slice(PREFIX_DEFLATE.length));
    const raw = await inflate(compressed);
    return parsePayload(raw);
  }
  if (code.startsWith(PREFIX_RAW)) {
    const raw = base62ToBytes(code.slice(PREFIX_RAW.length));
    return parsePayload(raw);
  }
  throw new Error(`코드는 ${PREFIX_RAW} 또는 ${PREFIX_DEFLATE}로 시작해야 합니다`);
}

export function buildInviteUrl(code: string, base?: string): string {
  const origin =
    base ?? (typeof window !== 'undefined' ? window.location.origin : 'https://want-escape.vercel.app');
  return `${origin}/invite/${code}`;
}
