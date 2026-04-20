import { Link } from 'react-router-dom';
import type { Theme } from '../lib/types';
import Grade from './Grade';
import { getAccent } from '../lib/accent';

interface Props {
  theme: Theme;
  rank?: number;
}

const DIFFICULTY_MAX = 11;

function Dots({ value, max = 3 }: { value?: number; max?: number }) {
  if (value == null) return null;
  return (
    <span className="dots" aria-label={`${value} / ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} data-on={i < value} />
      ))}
    </span>
  );
}

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

export default function ThemeCard({ theme }: Props) {
  const branchLine = [theme.branch, theme.subBranch].filter(Boolean).join(' · ');
  const accent = getAccent(theme);
  return (
    <Link
      to={`/theme/${encodeURIComponent(theme.id)}`}
      className="card"
      data-accent={accent?.kind}
    >
      {accent && (
        <span className="card__accent" aria-label={accent.label}>
          <AccentIcon kind={accent.kind} />
          {accent.label}
        </span>
      )}
      <div className="card__head">
        <Grade code={theme.gradeCode} />
        <span className="card__divider" aria-hidden />
        <span className="card__region">{theme.region || '기타'}</span>
      </div>
      <h3 className="card__name">{theme.name}</h3>
      <div className="card__branch">{branchLine}</div>
      {theme.oneLiner && <p className="card__oneliner">{theme.oneLiner}</p>}
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
      </div>
    </Link>
  );
}
