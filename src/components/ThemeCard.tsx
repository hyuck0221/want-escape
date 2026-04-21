import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Theme } from '../lib/types';
import Grade from './Grade';
import Dots from './Dots';
import Highlight from '../lib/highlight';
import { getAccent } from '../lib/accent';
import { toggleFlag, useUserFlags } from '../lib/userState';

interface Props {
  theme: Theme;
  rank?: number;
  query?: string;
}

const DIFFICULTY_MAX = 11;

function IdBadge({ id }: { id: string }) {
  return (
    <span className="meta-chip meta-chip--id" aria-label={`테마 번호 ${id}`}>
      #{id}
    </span>
  );
}

function DifficultyRing({ value }: { value: string }) {
  const num = Number(value);
  const hasValue = Number.isFinite(num) && num > 0;
  const r = 13;
  const C = 2 * Math.PI * r;
  const progress = hasValue ? Math.max(0, Math.min(1, num / DIFFICULTY_MAX)) : 0;
  const dashOffset = C * (1 - progress);
  const label = hasValue ? String(num) : value || '?';
  const tier = hasValue ? (num >= 10 ? 'high' : num >= 8 ? 'mid' : 'low') : 'unknown';
  return (
    <span
      className="meta-chip meta-chip--ring"
      data-tier={tier}
      aria-label={hasValue ? `난이도 ${num} / ${DIFFICULTY_MAX}` : `난이도 ${label}`}
    >
      <svg viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r={r} className="ring__track" />
        {hasValue && (
          <circle
            cx="16"
            cy="16"
            r={r}
            className="ring__fill"
            style={{ strokeDasharray: C, strokeDashoffset: dashOffset }}
          />
        )}
      </svg>
      <span className="ring__text">{label}</span>
    </span>
  );
}

function AccentIcon({ kind }: { kind: 'yellow' | 'red' | 'blue' }) {
  if (kind === 'yellow') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    );
  }
  if (kind === 'red') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="m13 2-3 9h6l-3 11" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M12 9v4M12 17h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export default function ThemeCard({ theme, query }: Props) {
  const headLine = [theme.branch, theme.region || '기타'].filter(Boolean).join(' · ');
  const accent = getAccent(theme);
  const played = useUserFlags('played');
  const wish = useUserFlags('wish');
  const isPlayed = played.has(theme.id);
  const isWished = wish.has(theme.id);

  const swallow = (fn: () => void) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <Link
      to={`/theme/${encodeURIComponent(theme.id)}`}
      className="card"
      data-accent={accent?.kind}
      data-played={isPlayed || undefined}
    >
      {accent && (
        <span className="card__accent" aria-label={accent.label}>
          <AccentIcon kind={accent.kind} />
          {accent.label}
        </span>
      )}
      <div className="card__head">
        <Grade code={theme.gradeCode} />
        <span className="card__region">
          <Highlight text={headLine} query={query} />
        </span>
      </div>
      <h3 className="card__name">
        <Highlight text={theme.name} query={query} />
      </h3>
      {theme.oneLiner && (
        <p className="card__oneliner">
          <Highlight text={theme.oneLiner} query={query} />
        </p>
      )}
      <div className="card__footer">
        <div className="card__meta">
          <IdBadge id={theme.id} />
          {theme.difficulty && <DifficultyRing value={theme.difficulty} />}
          {theme.fear != null && (
            <span className="meta-stat">
              <span className="meta-stat__label">공포</span>
              <Dots value={theme.fear} />
            </span>
          )}
          {theme.activity != null && (
            <span className="meta-stat">
              <span className="meta-stat__label">활동</span>
              <Dots value={theme.activity} />
            </span>
          )}
        </div>
        <div className="card__actions">
          <button
            type="button"
            className="card-action"
            data-active={isPlayed || undefined}
            data-tooltip="해봤어요"
            aria-pressed={isPlayed}
            aria-label="해봤어요"
            onClick={swallow(() => toggleFlag('played', theme.id))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="m5 12 5 5 9-11" />
            </svg>
          </button>
          <button
            type="button"
            className="card-action card-action--wish"
            data-active={isWished || undefined}
            data-tooltip="관심있어요"
            aria-pressed={isWished}
            aria-label="관심있어요"
            onClick={swallow(() => toggleFlag('wish', theme.id))}
          >
            <svg
              viewBox="0 0 24 24"
              fill={isWished ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>
    </Link>
  );
}
