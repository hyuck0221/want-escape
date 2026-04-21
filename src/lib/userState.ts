import { useEffect, useState } from 'react';

export type Flag = 'played' | 'wish';

const STORAGE_KEYS: Record<Flag, string> = {
  played: 'we-played-v1',
  wish: 'we-wish-v1',
};

function load(kind: Flag): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[kind]);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function persist(kind: Flag, set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

type Listener = () => void;
const listeners: Record<Flag, Set<Listener>> = {
  played: new Set(),
  wish: new Set(),
};
const stores: Record<Flag, Set<string>> = {
  played: load('played'),
  wish: load('wish'),
};

function emit(kind: Flag): void {
  for (const l of listeners[kind]) l();
}

export function hasFlag(kind: Flag, id: string): boolean {
  return stores[kind].has(id);
}

export function toggleFlag(kind: Flag, id: string): void {
  const s = stores[kind];
  if (s.has(id)) s.delete(id);
  else s.add(id);
  persist(kind, s);
  emit(kind);
}

export function clearFlag(kind: Flag): void {
  stores[kind] = new Set();
  persist(kind, stores[kind]);
  emit(kind);
}

export function getFlagSnapshot(kind: Flag): string[] {
  return [...stores[kind]];
}

export function readAllFlags(): { played: string[]; wish: string[] } {
  return {
    played: getFlagSnapshot('played'),
    wish: getFlagSnapshot('wish'),
  };
}

/**
 * Replace or merge both flag sets atomically.
 *  - mode 'replace': discard existing data and write the incoming set verbatim.
 *  - mode 'merge':   union with existing data.
 */
export function applyFlags(
  data: { played: string[]; wish: string[] },
  mode: 'replace' | 'merge',
): void {
  const nextPlayed = mode === 'replace' ? new Set<string>() : new Set(stores.played);
  const nextWish = mode === 'replace' ? new Set<string>() : new Set(stores.wish);
  for (const id of data.played) nextPlayed.add(String(id));
  for (const id of data.wish) nextWish.add(String(id));
  stores.played = nextPlayed;
  stores.wish = nextWish;
  persist('played', nextPlayed);
  persist('wish', nextWish);
  emit('played');
  emit('wish');
}

export function useUserFlags(kind: Flag): Set<string> {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((v) => v + 1);
    listeners[kind].add(l);
    return () => {
      listeners[kind].delete(l);
    };
  }, [kind]);
  return stores[kind];
}

export function useFlagCounts(): { played: number; wish: number } {
  const played = useUserFlags('played');
  const wish = useUserFlags('wish');
  return { played: played.size, wish: wish.size };
}
