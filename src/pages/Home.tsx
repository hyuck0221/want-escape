import { useMemo, useState } from 'react';
import ThemeCard from '../components/ThemeCard';
import { useThemeDataset } from '../lib/dataStore';
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

function compareGrade(a: Theme, b: Theme) {
  if (a.gradeRank !== b.gradeRank) return a.gradeRank - b.gradeRank;
  return a.name.localeCompare(b.name, 'ko');
}

function difficultyValue(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : -1;
}

export default function Home() {
  const { status, data, error } = useThemeDataset();

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string>('all');
  const [minGrade, setMinGrade] = useState<string>('all');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [sort, setSort] = useState<SortKey>('grade');

  const themes = data?.themes ?? [];

  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const t of themes) if (t.region) s.add(t.region);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [themes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const gradeMaxRank =
      minGrade === 'all'
        ? 99
        : (GRADE_ORDER.indexOf(minGrade as (typeof GRADE_ORDER)[number]) ?? 99);

    let list = themes.filter((t) => {
      if (!includeClosed && !t.operating) return false;
      if (region !== 'all' && t.region !== region) return false;
      if (gradeMaxRank < 99 && t.gradeRank > gradeMaxRank) return false;
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
  }, [themes, query, region, minGrade, includeClosed, sort]);

  const totalOperating = useMemo(() => themes.filter((t) => t.operating).length, [themes]);

  const hasActiveFilter =
    query.trim() !== '' || region !== 'all' || minGrade !== 'all' || includeClosed;

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
            직접 플레이한 방탈출 테마를 추천도·지역·난이도로 탐색하세요. 테마를 클릭하면
            세부 평점과 한줄평, 탈출 팁, 원문 인스타 리뷰까지 확인할 수 있어요.
          </p>
          {status === 'ready' && (
            <div className="hero__stats">
              <div className="hero__stat">
                <span className="hero__stat-num">{totalOperating.toLocaleString()}</span>
                <span className="hero__stat-label">운영중 테마</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-num">{regions.length}</span>
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
                onChange={(e) => setQuery(e.target.value)}
              />
              {status === 'ready' && (
                <span className="search-box__count">{filtered.length.toLocaleString()}개</span>
              )}
            </label>

            <div className="filters">
              <label className="filter">
                <span className="filter__label">지역</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="all">전체</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter">
                <span className="filter__label">최소 추천도</span>
                <select value={minGrade} onChange={(e) => setMinGrade(e.target.value)}>
                  <option value="all">전체</option>
                  {GRADE_ORDER.filter((g) => g !== 'Misc' && g !== 'X').map((g) => (
                    <option key={g} value={g}>
                      {g} 이상
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter">
                <span className="filter__label">정렬</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="grade">추천도 높은 순</option>
                  <option value="region">지역 순</option>
                  <option value="difficulty">난이도 낮은 순</option>
                  <option value="difficulty-desc">난이도 높은 순</option>
                </select>
              </label>

              <button
                type="button"
                className="filter-toggle"
                aria-pressed={includeClosed}
                onClick={() => setIncludeClosed((v) => !v)}
                title="폐업 / 기간한정 등 현재 플레이 불가 테마 포함"
              >
                폐업 포함
              </button>

              {hasActiveFilter && (
                <button
                  type="button"
                  className="filter-clear"
                  onClick={() => {
                    setQuery('');
                    setRegion('all');
                    setMinGrade('all');
                    setIncludeClosed(false);
                  }}
                >
                  초기화
                </button>
              )}
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
                <div className="grid">
                  {filtered.map((t) => (
                    <ThemeCard key={t.id} theme={t} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

    </>
  );
}
