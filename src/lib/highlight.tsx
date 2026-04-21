import { Fragment, type ReactNode } from 'react';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Props {
  text?: string | null;
  query?: string;
}

/**
 * Wraps case-insensitive matches of `query` in <mark>. When query is empty or
 * text missing, returns the text unchanged.
 */
export default function Highlight({ text, query }: Props): ReactNode {
  if (!text) return null;
  const q = (query ?? '').trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="hl">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
