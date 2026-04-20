import { useEffect, useState } from 'react';
import { parseWorkbook } from './parser';
import type { ThemeDataset } from './types';

export const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1f73hTHz50lqkuXD3KLy0Al7yUK80JSqrC0iUH3Xakwg/edit';

export const SHEET_EXPORT_URL =
  'https://docs.google.com/spreadsheets/d/1f73hTHz50lqkuXD3KLy0Al7yUK80JSqrC0iUH3Xakwg/export?format=xlsx&id=1f73hTHz50lqkuXD3KLy0Al7yUK80JSqrC0iUH3Xakwg';

export const INSTAGRAM_URL = 'https://www.instagram.com/want_escape_/';

// docs.google.com 의 export 엔드포인트는 redirect 후 CORS 를 허용하므로 브라우저에서 바로 fetch 가능.
const FETCH_URL = SHEET_EXPORT_URL;

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface State {
  status: Status;
  data: ThemeDataset | null;
  error: string | null;
}

let cached: ThemeDataset | null = null;
let inflight: Promise<ThemeDataset> | null = null;

async function loadDataset(): Promise<ThemeDataset> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(FETCH_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`시트 다운로드 실패 (${res.status})`);
    const buf = await res.arrayBuffer();
    const ds = parseWorkbook(buf);
    cached = ds;
    return ds;
  })();
  try {
    const ds = await inflight;
    return ds;
  } finally {
    inflight = null;
  }
}

export function useThemeDataset(): State {
  const [state, setState] = useState<State>({
    status: cached ? 'ready' : 'loading',
    data: cached,
    error: null,
  });

  useEffect(() => {
    if (cached) {
      setState({ status: 'ready', data: cached, error: null });
      return;
    }
    let alive = true;
    setState({ status: 'loading', data: null, error: null });
    loadDataset()
      .then((ds) => {
        if (!alive) return;
        setState({ status: 'ready', data: ds, error: null });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        setState({ status: 'error', data: null, error: msg });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
