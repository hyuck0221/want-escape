import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'we-theme';

function getInitial(): ThemeMode {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

// Shared global state so every component that calls useTheme re-renders in sync
// when theme is toggled anywhere (e.g. settings page ↔ header icon).
let currentTheme: ThemeMode = getInitial();
const listeners = new Set<(t: ThemeMode) => void>();

function applyTheme(next: ThemeMode): void {
  if (next === currentTheme) return;
  currentTheme = next;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', next);
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
  for (const l of listeners) l(next);
}

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', currentTheme);
}

export function useTheme() {
  const [theme, setLocal] = useState<ThemeMode>(currentTheme);

  useEffect(() => {
    setLocal(currentTheme);
    listeners.add(setLocal);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    applyTheme(next);
  }, []);

  const toggle = useCallback(() => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, setTheme, toggle } as const;
}
