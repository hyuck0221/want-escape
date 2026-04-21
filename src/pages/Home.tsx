import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ThemeCard from '../components/ThemeCard';
import Dropdown from '../components/Dropdown';
import { useThemeDataset } from '../lib/dataStore';
import { useUserFlags } from '../lib/userState';
import type { Theme } from '../lib/types';

type SortKey = 'grade' | 'region' | 'difficulty' | 'difficulty-desc';

const GRADE_ORDER = [
  'S++',
  'S+',
  'S',
  'A+',
  'A',
  'B+',
  'B',
  'C+',
  'C',
  'F',
  'X',
  'Misc',
] as const;

const MAIN_GRADES = [
  'S++',
  'S+',
  'S',
  'A+',
  'A',
  'B+',
  'B',
  'C+',
  'C',
  'F',
] as const;

// Any gradeCode not in MAIN_GRADES (including 'X' and anything unknown) rolls into 'Misc'.
function effectiveGrade(code: string): string {
  return (MAIN_GRADES as readonly string[]).includes(code) ? code : 'Misc';
}

const DIFFICULTY_FILTER_OPTIONS = [
  '11',
  '10',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
  '1',
  'Misc',
] as const;

function difficultyBucket(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 11) return 'Misc';
  if (Number.isInteger(n)) return String(n);
  return 'Misc';
}

const PLAY_FILTERS = ['all', 'unplayed', 'played', 'wish'] as const;
type PlayFilter = (typeof PLAY_FILTERS)[number];

const INITIAL_VISIBLE = 48;
const PAGE_SIZE = 24;

function compareGrade(a: Theme, b: Theme) {
  if (a.gradeRank !== b.gradeRank) return a.gradeRank - b.gradeRank;
  return a.name.localeCompare(b.name, 'ko');
}

function difficultyValue(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : -1;
}

function isSortKey(v: string | null): v is SortKey {
  return v === 'grade' || v === 'region' || v === 'difficulty' || v === 'difficulty-desc';
}

function isPlayFilter(v: string | null): v is PlayFilter {
  return !!v && (PLAY_FILTERS as readonly string[]).includes(v);
}

export default function Home() {
  const { status, data, error } = useThemeDataset();
  const [params, setParams] = useSearchParams();

  const query = params.get('q') ?? '';
  const regionsParam = params.get('regions') ?? '';
  const selectedRegions = useMemo(
    () => (regionsParam ? regionsParam.split(',').filter(Boolean) : []),
    [regionsParam],
  );
  const gradesParam = params.get('grades') ?? '';
  const selectedGrades = useMemo(
    () => (gradesParam ? gradesParam.split(',').filter(Boolean) : []),
    [gradesParam],
  );
  const difficultiesParam = params.get('difficulties') ?? '';
  const selectedDifficulties = useMemo(
    () => (difficultiesParam ? difficultiesParam.split(',').filter(Boolean) : []),
    [difficultiesParam],
  );
  const includeClosed = params.get('closed') === '1';
  const play: PlayFilter = isPlayFilter(params.get('play')) ? (params.get('play') as PlayFilter) : 'all';
  const sortParam = params.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'grade';

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v == null || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const themes = data?.themes ?? [];
  const played = useUserFlags('played');
  const wish = useUserFlags('wish');

  const allRegions = useMemo(() => {
    const s = new Set<string>();
    for (const t of themes) if (t.region) s.add(t.region);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [themes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = themes.filter((t) => {
      if (!includeClosed && !t.operating) return false;
      if (selectedRegions.length > 0 && !selectedRegions.includes(t.region)) return false;
      if (selectedGrades.length > 0 && !selectedGrades.includes(effectiveGrade(t.gradeCode))) return false;
      if (
        selectedDifficulties.length > 0 &&
        !selectedDifficulties.includes(difficultyBucket(t.difficulty))
      )
        return false;
      if (play === 'unplayed' && played.has(t.id)) return false;
      if (play === 'played' && !played.has(t.id)) return false;
      if (play === 'wish' && !wish.has(t.id)) return false;
      if (q) {
        const hay = [
          t.name,
          t.branch,
          t.subBranch,
          t.region,
          t.regionGroup,
          t.oneLiner,
          t.escapeTip,
          t.gradeCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list];
    if (sort === 'grade') list.sort(compareGrade);
    else if (sort === 'region')
      list.sort((a, b) => {
        const r = (a.region || '').localeCompare(b.region || '', 'ko');
        if (r !== 0) return r;
        return compareGrade(a, b);
      });
    else if (sort === 'difficulty')
      list.sort((a, b) => {
        const d = difficultyValue(a.difficulty) - difficultyValue(b.difficulty);
        if (d !== 0) return d;
        return compareGrade(a, b);
      });
    else if (sort === 'difficulty-desc')
      list.sort((a, b) => {
        const d = difficultyValue(b.difficulty) - difficultyValue(a.difficulty);
        if (d !== 0) return d;
        return compareGrade(a, b);
      });
    return list;
  }, [
    themes,
    query,
    selectedRegions,
    selectedGrades,
    selectedDifficulties,
    includeClosed,
    sort,
    play,
    played,
    wish,
  ]);

  const totalOperating = useMemo(() => themes.filter((t) => t.operating).length, [themes]);

  const hasActiveFilter =
    query.trim() !== '' ||
    selectedRegions.length > 0 ||
    selectedGrades.length > 0 ||
    selectedDifficulties.length > 0 ||
    includeClosed ||
    play !== 'all';

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [query, regionsParam, gradesParam, difficultiesParam, includeClosed, sort, play]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (visibleCount >= filtered.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
          }
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, filtered.length]);

  const visibleThemes = filtered.slice(0, visibleCount);

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero__eyebrow">an archive by @want_escape_</div>
          <h1 className="hero__title">
            직접 평가한 <em>방탈출</em>,
            <br />
            전부 한 자리에.
          </h1>
          <p className="hero__lead">
            직접 플레이 해본 방탈출 테마를 추천도·지역·난이도로 탐색하세요. 테마를 클릭하면
            세부 평점과 한줄평, 탈출 팁, 원문 인스타 리뷰까지 확인할 수 있어요.
          </p>
          {status === 'ready' && (
            <div className="hero__stats">
              <div className="hero__stat">
                <span className="hero__stat-num">{totalOperating.toLocaleString()}</span>
                <span className="hero__stat-label">운영중 테마</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-num">{allRegions.length}</span>
                <span className="hero__stat-label">지역</span>
              </div>
              {data?.meta.lastUpdated && (
                <div className="hero__stat">
                  <span className="hero__stat-num">{data.meta.lastUpdated}</span>
                  <span className="hero__stat-label">최신 업데이트</span>
                </div>
              )}
            </div>
          )}

          <div className="controls">
            <label className="search-box">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                inputMode="search"
                placeholder="테마, 지점명, 지역, 한줄평 검색…"
                value={query}
                onChange={(e) => updateParams({ q: e.target.value })}
              />
              {status === 'ready' && (
                <span className="search-box__count">{filtered.length.toLocaleString()}개</span>
              )}
            </label>

            <div className="filters">
              <Dropdown
                multiple
                label="지역"
                value={selectedRegions}
                options={allRegions.map((r) => ({ value: r, label: r }))}
                onChange={(next) =>
                  updateParams({ regions: next.length ? next.join(',') : null })
                }
              />
              <Dropdown
                multiple
                label="추천도"
                value={selectedGrades}
                options={[...MAIN_GRADES, 'Misc'].map((g) => ({ value: g, label: g }))}
                onChange={(next) =>
                  updateParams({ grades: next.length ? next.join(',') : null })
                }
              />
              <Dropdown
                multiple
                label="난이도"
                value={selectedDifficulties}
                options={DIFFICULTY_FILTER_OPTIONS.map((d) => ({ value: d, label: d }))}
                onChange={(next) =>
                  updateParams({ difficulties: next.length ? next.join(',') : null })
                }
              />
              <Dropdown
                label="정렬"
                value={sort}
                options={[
                  { value: 'grade', label: '추천도 높은 순' },
                  { value: 'region', label: '지역 순' },
                  { value: 'difficulty', label: '난이도 낮은 순' },
                  { value: 'difficulty-desc', label: '난이도 높은 순' },
                ]}
                onChange={(v) => updateParams({ sort: v === 'grade' ? null : v })}
              />
              <Dropdown
                label="보기"
                value={play}
                options={[
                  { value: 'all', label: '전체' },
                  { value: 'unplayed', label: '안 해본 것만' },
                  { value: 'played', label: '해봤어요', hint: played.size },
                  { value: 'wish', label: '관심있어요', hint: wish.size },
                ]}
                onChange={(v) => updateParams({ play: v === 'all' ? null : v })}
              />

              <button
                type="button"
                className="filter-toggle filter-toggle--end"
                aria-pressed={includeClosed}
                onClick={() => updateParams({ closed: includeClosed ? null : '1' })}
              >
                폐업 포함
              </button>

              <button
                type="button"
                className="filter-clear"
                disabled={!hasActiveFilter}
                onClick={() =>
                  updateParams({
                    q: null,
                    regions: null,
                    grades: null,
                    difficulties: null,
                    closed: null,
                    play: null,
                    sort: null,
                  })
                }
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="results">
        <div className="container">
          {status === 'loading' && (
            <>
              <div className="results__head">
                <div className="results__title">시트에서 데이터 불러오는 중…</div>
              </div>
              <div className="skeleton">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="skeleton__card" />
                ))}
              </div>
            </>
          )}

          {status === 'error' && (
            <div className="state">
              <h3>데이터를 불러오지 못했어요</h3>
              <p>{error}</p>
              <p style={{ marginTop: 12 }}>
                네트워크를 확인하고 새로고침 해주세요. 브라우저의 CORS 설정에 의해 차단될 수
                있으며, 이 경우 원본 시트에서 직접 확인하실 수 있어요.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="results__head">
                <div className="results__title">
                  <strong>{filtered.length.toLocaleString()}</strong>
                  개의 테마
                  {sort === 'grade' && <> · 추천도 순</>}
                  {sort === 'region' && <> · 지역 순</>}
                  {(sort === 'difficulty' || sort === 'difficulty-desc') && <> · 난이도 순</>}
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="state">
                  <h3>검색 결과가 없어요</h3>
                  <p>다른 키워드로 시도해보거나 필터를 초기화해주세요.</p>
                </div>
              ) : (
                <>
                  <div className="grid">
                    {visibleThemes.map((t) => (
                      <ThemeCard key={t.id} theme={t} query={query} />
                    ))}
                  </div>
                  {visibleCount < filtered.length && (
                    <div className="infinite-sentinel" ref={sentinelRef} aria-hidden>
                      <span className="infinite-sentinel__spinner" />
                      더 불러오는 중…
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
