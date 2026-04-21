import { useEffect, useState } from 'react';
import type { ThemeDataset } from './types';

export const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1f73hTHz50lqkuXD3KLy0Al7yUK80JSqrC0iUH3Xakwg/edit';

export const SHEET_EXPORT_URL =
  'https://docs.google.com/spreadsheets/d/1f73hTHz50lqkuXD3KLy0Al7yUK80JSqrC0iUH3Xakwg/export?format=xlsx&id=1f73hTHz50lqkuXD3KLy0Al7yUK80JSqrC0iUH3Xakwg';

export const INSTAGRAM_URL = 'https://www.instagram.com/want_escape_/';

const FETCH_URL = SHEET_EXPORT_URL;

const CACHE_KEY = 'we-dataset-v1';
const CACHE_ENABLED_KEY = 'we-cache-enabled';
const CACHE_VERSION = 1;
const FRESH_MS = 60 * 60 * 1000; // 1 h  — within this: cache only, no network
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // 30 d — beyond this: discard

export function isCacheEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(CACHE_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setCacheEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(CACHE_ENABLED_KEY);
    else {
      localStorage.setItem(CACHE_ENABLED_KEY, 'false');
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface DatasetState {
  status: Status;
  data: ThemeDataset | null;
  error: string | null;
  /** Unix ms timestamp of the last *network* fetch that produced the current data. */
  fetchedAt: number | null;
  /** True while a background revalidation is in-flight. */
  revalidating: boolean;
}

interface CacheEntry {
  v: number;
  data: ThemeDataset;
  fetchedAt: number;
  contentHash: string;
  contentLength: number;
}

// ---------- Persistence ----------
function readCache(): CacheEntry | null {
  if (!isCacheEnabled()) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry?.v !== CACHE_VERSION || !entry?.data?.themes?.length) return null;
    if (Date.now() - entry.fetchedAt > EXPIRE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  if (!isCacheEnabled()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // storage full / disabled / JSON too big — continue with in-memory only
  }
}

function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- Network + parse ----------
async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return `${buf.byteLength}`; // fallback: rely on content-length for change detection
  }
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchFresh(): Promise<{
  data: ThemeDataset;
  hash: string;
  length: number;
}> {
  const res = await fetch(FETCH_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`시트 다운로드 실패 (${res.status})`);
  const buf = await res.arrayBuffer();
  // Lazy-import parser (pulls in the 500KB xlsx lib only on cache miss / revalidation)
  const [hash, parserMod] = await Promise.all([sha256Hex(buf), import('./parser')]);
  const data = parserMod.parseWorkbook(buf);
  return { data, hash, length: buf.byteLength };
}

// ---------- Global state + listener fan-out ----------
type Listener = (s: DatasetState) => void;
const listeners = new Set<Listener>();

let globalState: DatasetState = {
  status: 'idle',
  data: null,
  error: null,
  fetchedAt: null,
  revalidating: false,
};

function setGlobal(next: Partial<DatasetState>): void {
  globalState = { ...globalState, ...next };
  for (const l of listeners) l(globalState);
}

let initialized = false;
let inflight: Promise<void> | null = null;

function runInitialLoad() {
  if (initialized) return;
  initialized = true;

  const cache = readCache();
  const now = Date.now();

  if (cache) {
    // Synchronously paint from cache — no network, no parser, instant render.
    globalState = {
      status: 'ready',
      data: cache.data,
      error: null,
      fetchedAt: cache.fetchedAt,
      revalidating: false,
    };
    for (const l of listeners) l(globalState);
    const age = now - cache.fetchedAt;
    if (age < FRESH_MS) return; // fresh — skip network entirely
    revalidate(cache); // stale — refresh in background
    return;
  }

  // No cache: must block on network for first render.
  globalState = {
    status: 'loading',
    data: null,
    error: null,
    fetchedAt: null,
    revalidating: false,
  };
  for (const l of listeners) l(globalState);
  inflight = (async () => {
    try {
      const { data, hash, length } = await fetchFresh();
      const fetchedAt = Date.now();
      writeCache({ v: CACHE_VERSION, data, contentHash: hash, contentLength: length, fetchedAt });
      setGlobal({ status: 'ready', data, error: null, fetchedAt, revalidating: false });
    } catch (err) {
      setGlobal({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : '알 수 없는 오류',
        fetchedAt: null,
        revalidating: false,
      });
    } finally {
      inflight = null;
    }
  })();
}

// Eagerly initialize on module load so the very first render of <Home/> already
// reflects cached data (no "loading" flash for return visitors).
if (typeof window !== 'undefined') {
  runInitialLoad();
}

async function revalidate(prev: CacheEntry) {
  if (inflight) return;
  setGlobal({ revalidating: true });
  inflight = (async () => {
    try {
      const { data, hash, length } = await fetchFresh();
      const fetchedAt = Date.now();
      if (hash === prev.contentHash) {
        // Content unchanged — just bump the freshness timestamp.
        writeCache({ ...prev, fetchedAt });
        setGlobal({ fetchedAt, revalidating: false });
        return;
      }
      writeCache({ v: CACHE_VERSION, data, contentHash: hash, contentLength: length, fetchedAt });
      setGlobal({ status: 'ready', data, error: null, fetchedAt, revalidating: false });
    } catch {
      // keep the stale data visible; the user never sees an error on revalidation
      setGlobal({ revalidating: false });
    } finally {
      inflight = null;
    }
  })();
}

/** Force a refresh from network, bypassing the freshness window. */
export async function refreshDataset(): Promise<void> {
  if (inflight) return inflight;
  const cache = readCache();
  if (cache) {
    await revalidate(cache);
  } else {
    initialized = false;
    runInitialLoad();
    if (inflight) await inflight;
  }
}

/** Dev / debug helper to wipe persisted data. */
export function clearDatasetCache(): void {
  clearCache();
  initialized = false;
  globalState = {
    status: 'idle',
    data: null,
    error: null,
    fetchedAt: null,
    revalidating: false,
  };
}

// ---------- Hook ----------
export function useThemeDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    setState(globalState);
    runInitialLoad();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
