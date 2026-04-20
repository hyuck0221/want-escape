import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useThemeDataset } from '../lib/dataStore';
import Grade from '../components/Grade';
import Dots from '../components/Dots';
import InstagramEmbed, { toEmbedUrl } from '../components/InstagramEmbed';
import ThemeCard from '../components/ThemeCard';
import { getAccent } from '../lib/accent';
import type { DetailedRating, Theme } from '../lib/types';

const RELATED_PAGE_SIZE = 6;
const FEAR_NEIGHBORHOOD = 1;
const ACTIVITY_NEIGHBORHOOD = 1;
const DIFFICULTY_NEIGHBORHOOD = 1;

function ratingTotal(t: Theme): number | null {
  const v = t.rating?.total;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function difficultyNum(t: Theme): number | null {
  const n = Number(t.difficulty);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildRelatedThemes(all: Theme[], current: Theme): Theme[] {
  const pool = all.filter((t) => t.id !== current.id && t.operating);
  const currentFear = current.fear;
  const currentActivity = current.activity;
  const currentDifficulty = difficultyNum(current);

  const seen = new Set<string>();
  const result: Theme[] = [];
  const pushUnique = (list: Theme[]) => {
    for (const t of list) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      result.push(t);
    }
  };

  const byNameKo = (a: Theme, b: Theme) => a.name.localeCompare(b.name, 'ko');

  // 1. Same cafe (branch)
  if (current.branch) {
    const sameCafe = pool
      .filter((t) => t.branch === current.branch)
      .sort((a, b) => {
        const ra = ratingTotal(a) ?? -1;
        const rb = ratingTotal(b) ?? -1;
        if (rb !== ra) return rb - ra;
        if (a.gradeRank !== b.gradeRank) return a.gradeRank - b.gradeRank;
        return byNameKo(a, b);
      });
    pushUnique(sameCafe);
  }

  // 2. Similar difficulty
  if (currentDifficulty != null) {
    const similarDifficulty = pool
      .map((t) => ({ t, d: difficultyNum(t) }))
      .filter(
        (x): x is { t: Theme; d: number } =>
          x.d != null && Math.abs(x.d - currentDifficulty) <= DIFFICULTY_NEIGHBORHOOD,
      )
      .sort((a, b) => {
        const da = Math.abs(a.d - currentDifficulty);
        const db = Math.abs(b.d - currentDifficulty);
        if (da !== db) return da - db;
        return byNameKo(a.t, b.t);
      })
      .map((x) => x.t);
    pushUnique(similarDifficulty);
  }

  // 3. Similar fear
  if (currentFear != null) {
    const similarFear = pool
      .filter(
        (t) =>
          t.fear != null &&
          Math.abs(t.fear - currentFear) <= FEAR_NEIGHBORHOOD,
      )
      .sort((a, b) => {
        const da = Math.abs((a.fear ?? 0) - currentFear);
        const db = Math.abs((b.fear ?? 0) - currentFear);
        if (da !== db) return da - db;
        return byNameKo(a, b);
      });
    pushUnique(similarFear);
  }

  // 4. Similar activity
  if (currentActivity != null) {
    const similarActivity = pool
      .filter(
        (t) =>
          t.activity != null &&
          Math.abs(t.activity - currentActivity) <= ACTIVITY_NEIGHBORHOOD,
      )
      .sort((a, b) => {
        const da = Math.abs((a.activity ?? 0) - currentActivity);
        const db = Math.abs((b.activity ?? 0) - currentActivity);
        if (da !== db) return da - db;
        return byNameKo(a, b);
      });
    pushUnique(similarActivity);
  }

  return result;
}

function DotsOrDash({ value, max }: { value?: number; max?: number }) {
  if (value == null) return <span style={{ color: 'var(--fg-4)' }}>—</span>;
  return <Dots value={value} max={max} />;
}

const RATING_LABELS: Array<{ key: keyof DetailedRating; label: string }> = [
  { key: 'problem', label: '문제' },
  { key: 'interior', label: '인테리어' },
  { key: 'story', label: '스토리' },
  { key: 'creativity', label: '창의성' },
  { key: 'direction', label: '연출' },
];

function ratingNumber(value: number | string | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function ThemeDetail() {
  const { id = '' } = useParams();
  const { status, data } = useThemeDataset();
  const [visibleRelated, setVisibleRelated] = useState(RELATED_PAGE_SIZE);

  const decoded = decodeURIComponent(id);
  const theme = data?.themes.find((t) => t.id === decoded);

  const relatedThemes = useMemo(() => {
    if (!data || !theme) return [];
    return buildRelatedThemes(data.themes, theme);
  }, [data, theme]);

  useEffect(() => {
    setVisibleRelated(RELATED_PAGE_SIZE);
  }, [theme?.id]);

  if (status !== 'ready') {
    return (
      <section className="detail">
        <div className="container">
          <div className="state">
            <h3>불러오는 중…</h3>
          </div>
        </div>
      </section>
    );
  }

  if (!theme) {
    return (
      <section className="detail">
        <div className="container">
          <div className="state">
            <h3>해당 테마를 찾을 수 없어요</h3>
            <p>
              <Link to="/" style={{ textDecoration: 'underline' }}>
                목록으로 돌아가기
              </Link>
            </p>
          </div>
        </div>
      </section>
    );
  }

  const rating = theme.rating;
  const hasRatings =
    !!rating &&
    RATING_LABELS.some(({ key }) => ratingNumber(rating[key]) != null) &&
    rating.total != null;
  const hasExtraRemark = !!theme.remark && !/폐업/.test(theme.remark);
  const accent = getAccent(theme);
  const hasEmbed = theme.reviewLink ? !!toEmbedUrl(theme.reviewLink) : false;

  return (
    <section className="detail">
      <div className="container">
        <Link to="/" className="detail__back">
          <svg
            viewBox="0 0 24 24"
            width={12}
            height={12}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          전체 목록
        </Link>

        <header className="detail__header">
          <div className="detail__kicker">
            <Grade code={theme.gradeCode} size="lg" />
            <span className="region-tag">{theme.region || '기타'}</span>
            {theme.regionGroup && theme.regionGroup !== '(미분류)' && (
              <span>· {theme.regionGroup}</span>
            )}
            {!theme.operating && <span className="remark-chip remark-chip--danger">폐업</span>}
            {theme.remark && theme.operating && /기간한정|한정|이벤트/.test(theme.remark) && (
              <span className="remark-chip remark-chip--brand">{theme.remark}</span>
            )}
            <span className="id-tag">[{theme.id}]</span>
          </div>

          <h1 className="detail__title">{theme.name}</h1>
          <div className="detail__branch">
            {[theme.branch, theme.subBranch].filter(Boolean).join(' · ')}
          </div>
        </header>

        <div className="detail__grid">
          <div className="detail__content">
            {theme.oneLiner && (
              <div className="detail__oneliner" data-accent={accent?.kind}>
                “{theme.oneLiner}”
              </div>
            )}

            <div className="section">
              <div className="section__title">테마 정보</div>
              <div className="stat-row">
                <div className="stat">
                  <span className="stat__label">추천도</span>
                  <span className="stat__value">
                    <Grade code={theme.gradeCode} />
                  </span>
                </div>
                <div className="stat">
                  <span className="stat__label">난이도</span>
                  <span className="stat__value">{theme.difficulty || '—'}</span>
                </div>
                <div className="stat">
                  <span className="stat__label">공포도</span>
                  <span className="stat__value">
                    <DotsOrDash value={theme.fear} />
                  </span>
                </div>
                <div className="stat">
                  <span className="stat__label">활동성</span>
                  <span className="stat__value">
                    <DotsOrDash value={theme.activity} />
                  </span>
                </div>
              </div>
            </div>

            {hasRatings && rating && (
              <div className="section">
                <div className="section__title">세부 평점</div>
                <div className="rating-bars">
                  {rating.total != null && (
                    <div
                      className="rating-overall"
                      data-tier={rating.total >= 6 ? 'exceptional' : undefined}
                    >
                      <span className="rating-overall__number">{rating.total.toFixed(2)}</span>
                      <span className="rating-overall__suffix">/ 5.00 종합 평점</span>
                    </div>
                  )}
                  {RATING_LABELS.map(({ key, label }) => {
                    const value = ratingNumber(rating[key]);
                    const exceptional = value != null && value >= 6;
                    return (
                      <div
                        key={key}
                        className="rating-bar"
                        data-tier={exceptional ? 'exceptional' : undefined}
                      >
                        <span className="rating-bar__label">{label}</span>
                        <span className="rating-bar__track">
                          {value != null && (
                            <span
                              className="rating-bar__fill"
                              style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }}
                            />
                          )}
                        </span>
                        <span className="rating-bar__value">
                          {value != null ? value : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="detail__note">
                  * 세부 평점은 운영자의 주관적 평가입니다.
                </p>
              </div>
            )}

            {theme.escapeTip && (
              <div className="section">
                <div className="section__title">탈출 팁</div>
                <div className="tip-block">
                  <div className="tip-block__label">hint</div>
                  <div className="tip-block__body">{theme.escapeTip}</div>
                </div>
              </div>
            )}

            {hasExtraRemark && (
              <div className="section">
                <div className="section__title">비고</div>
                <div className="remark-card">{theme.remark}</div>
              </div>
            )}

            {theme.reviewLink && !hasEmbed && (
              <div className="section">
                <div className="section__title">원문 리뷰</div>
                <a
                  className="review-link"
                  href={theme.reviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  인스타그램에서 보기
                </a>
              </div>
            )}
          </div>

          {theme.reviewLink && hasEmbed && (
            <aside className="detail__media">
              <InstagramEmbed url={theme.reviewLink} />
              <a
                className="review-link"
                href={theme.reviewLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                인스타그램에서 전문 보기
              </a>
            </aside>
          )}
        </div>

        {relatedThemes.length > 0 && (
          <section className="related">
            <div className="related__head">
              <h2 className="related__title">관련 테마 리뷰</h2>
              <span className="related__caption">
                {[
                  '같은 카페',
                  Number.isFinite(Number(theme.difficulty)) &&
                    Number(theme.difficulty) > 0 &&
                    '비슷한 난이도',
                  theme.fear != null && '비슷한 공포도',
                  theme.activity != null && '비슷한 활동성',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <div className="grid">
              {relatedThemes.slice(0, visibleRelated).map((t) => (
                <ThemeCard key={t.id} theme={t} />
              ))}
            </div>
            {visibleRelated < relatedThemes.length && (
              <div className="related__more">
                <button
                  type="button"
                  className="related__more-btn"
                  onClick={() =>
                    setVisibleRelated((c) => c + RELATED_PAGE_SIZE)
                  }
                >
                  더보기
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
