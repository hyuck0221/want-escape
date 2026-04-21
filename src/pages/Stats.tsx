import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useThemeDataset } from '../lib/dataStore';
import Grade from '../components/Grade';
import { useUserFlags } from '../lib/userState';
import type { GradeCode, Theme } from '../lib/types';

const MAIN_GRADES: GradeCode[] = [
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
];
const GRADE_ORDER: GradeCode[] = [...MAIN_GRADES, 'Misc'];

function mean(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

interface CafeAgg {
  branch: string;
  count: number;
  avgRating: number | null;
  avgGradeRank: number;
  avgDifficulty: number | null;
  avgFear: number | null;
  avgActivity: number | null;
}

function aggregateCafes(themes: Theme[]): CafeAgg[] {
  const map = new Map<string, Theme[]>();
  for (const t of themes) {
    if (!t.branch) continue;
    const arr = map.get(t.branch) ?? [];
    arr.push(t);
    map.set(t.branch, arr);
  }
  const out: CafeAgg[] = [];
  for (const [branch, list] of map) {
    out.push({
      branch,
      count: list.length,
      avgRating: mean(
        list
          .map((t) => t.rating?.total)
          .filter((v): v is number => typeof v === 'number'),
      ),
      avgGradeRank: mean(list.map((t) => t.gradeRank)) ?? 99,
      avgDifficulty: mean(
        list
          .map((t) => Number(t.difficulty))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
      avgFear: mean(
        list.map((t) => t.fear).filter((v): v is number => typeof v === 'number'),
      ),
      avgActivity: mean(
        list.map((t) => t.activity).filter((v): v is number => typeof v === 'number'),
      ),
    });
  }
  return out;
}

export default function Stats() {
  const { status, data } = useThemeDataset();
  const played = useUserFlags('played');
  const wish = useUserFlags('wish');

  const stats = useMemo(() => {
    const themes = data?.themes ?? [];
    const operating = themes.filter((t) => t.operating);
    const closed = themes.filter((t) => !t.operating);

    // Grade distribution (operating only for primary chart).
    // Anything outside the main grades (e.g. 'X' or unknown) rolls into 'Misc'.
    const gradeCount = new Map<GradeCode, number>();
    for (const code of GRADE_ORDER) gradeCount.set(code, 0);
    for (const t of operating) {
      const bucket: GradeCode = MAIN_GRADES.includes(t.gradeCode) ? t.gradeCode : 'Misc';
      gradeCount.set(bucket, (gradeCount.get(bucket) ?? 0) + 1);
    }
    const maxGrade = Math.max(1, ...Array.from(gradeCount.values()));

    // Region distribution
    const regionCount = new Map<string, number>();
    for (const t of operating) {
      if (!t.region) continue;
      regionCount.set(t.region, (regionCount.get(t.region) ?? 0) + 1);
    }
    const regionRanked = Array.from(regionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
    const maxRegion = Math.max(1, ...regionRanked.map(([, v]) => v));

    // Cafe rankings (min 2 themes for meaningful averages)
    const allCafes = aggregateCafes(operating).filter((c) => c.count >= 2);
    const hardestCafes = allCafes
      .filter((c) => c.avgDifficulty != null)
      .sort((a, b) => (b.avgDifficulty ?? 0) - (a.avgDifficulty ?? 0))
      .slice(0, 10);
    const scariestCafes = allCafes
      .filter((c) => c.avgFear != null)
      .sort((a, b) => (b.avgFear ?? 0) - (a.avgFear ?? 0))
      .slice(0, 10);
    const activeCafes = allCafes
      .filter((c) => c.avgActivity != null)
      .sort((a, b) => (b.avgActivity ?? 0) - (a.avgActivity ?? 0))
      .slice(0, 10);

    // Difficulty distribution — 11 → 3, merged 1~2, + Misc
    const diffOrder = [11, 10, 9, 8, 7, 6, 5, 4, 3];
    const diffCounts: Array<{ label: string; n: number }> = diffOrder.map((v) => ({
      label: String(v),
      n: operating.filter((t) => Number(t.difficulty) === v).length,
    }));
    const lowDiff = operating.filter((t) => {
      const n = Number(t.difficulty);
      return Number.isFinite(n) && n >= 1 && n <= 2;
    }).length;
    diffCounts.push({ label: '1~2', n: lowDiff });
    const miscDiff = operating.filter((t) => {
      const n = Number(t.difficulty);
      return !Number.isFinite(n) || n < 1 || n > 11;
    }).length;
    diffCounts.push({ label: 'Misc', n: miscDiff });
    const maxDiff = Math.max(1, ...diffCounts.map((d) => d.n));

    // Region average rating
    const regionRatings = new Map<string, number[]>();
    for (const t of operating) {
      if (!t.region) continue;
      const r = t.rating?.total;
      if (typeof r !== 'number' || !Number.isFinite(r)) continue;
      const arr = regionRatings.get(t.region) ?? [];
      arr.push(r);
      regionRatings.set(t.region, arr);
    }
    const regionAvgRanked = Array.from(regionRatings.entries())
      .filter(([, arr]) => arr.length >= 2)
      .map(([name, arr]) => ({
        name,
        avg: arr.reduce((a, b) => a + b, 0) / arr.length,
        count: arr.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 12);
    const maxRegionAvg = Math.max(1, ...regionAvgRanked.map((r) => r.avg));

    // Overall averages
    const avgRating = mean(
      themes
        .map((t) => t.rating?.total)
        .filter((v): v is number => typeof v === 'number'),
    );
    const avgDifficulty = mean(
      operating
        .map((t) => Number(t.difficulty))
        .filter((n) => Number.isFinite(n) && n > 0),
    );

    return {
      total: themes.length,
      operatingCount: operating.length,
      closedCount: closed.length,
      gradeCount,
      maxGrade,
      regionRanked,
      maxRegion,
      regionAvgRanked,
      maxRegionAvg,
      hardestCafes,
      scariestCafes,
      activeCafes,
      diffCounts,
      maxDiff,
      avgRating,
      avgDifficulty,
    };
  }, [data]);

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

  const playedOperating = data
    ? data.themes.filter((t) => played.has(t.id) && t.operating).length
    : 0;
  const wishOperating = data
    ? data.themes.filter((t) => wish.has(t.id) && t.operating).length
    : 0;

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
          <h1 className="detail__title">통계</h1>
          <div className="detail__branch">
            운영중 {stats.operatingCount}개 · 폐업/종료 {stats.closedCount}개 · 총 {stats.total}개
          </div>
        </header>

        <div className="cafe-stats">
          <div className="cafe-stat">
            <span className="cafe-stat__label">평균 종합 평점</span>
            <span className="cafe-stat__value">
              {stats.avgRating != null ? stats.avgRating.toFixed(2) : '—'}
            </span>
          </div>
          <div className="cafe-stat">
            <span className="cafe-stat__label">평균 난이도</span>
            <span className="cafe-stat__value">
              {stats.avgDifficulty != null ? stats.avgDifficulty.toFixed(1) : '—'}
            </span>
          </div>
          <div className="cafe-stat">
            <span className="cafe-stat__label">해봤어요</span>
            <span className="cafe-stat__value">{playedOperating}</span>
          </div>
          <div className="cafe-stat">
            <span className="cafe-stat__label">관심있어요</span>
            <span className="cafe-stat__value">{wishOperating}</span>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stats-card">
            <div className="section__title">추천도 분포 (운영중)</div>
            <div className="bars">
              {GRADE_ORDER.map((g) => {
                const n = stats.gradeCount.get(g) ?? 0;
                const w = `${(n / stats.maxGrade) * 100}%`;
                return (
                  <div key={g} className="bars__row">
                    <span className="bars__key">
                      <Grade code={g} />
                    </span>
                    <span className="bars__track">
                      <span className="bars__fill" style={{ width: w }} />
                    </span>
                    <span className="bars__value">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="stats-card">
            <div className="section__title">난이도 분포 (운영중)</div>
            <div className="bars">
              {stats.diffCounts.map((b) => {
                const w = `${(b.n / stats.maxDiff) * 100}%`;
                return (
                  <div key={b.label} className="bars__row">
                    <span className="bars__key bars__key--text">{b.label}</span>
                    <span className="bars__track">
                      <span className="bars__fill" style={{ width: w }} />
                    </span>
                    <span className="bars__value">{b.n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="stats-card">
            <div className="section__title">리뷰 많은 지역 Top {stats.regionRanked.length}</div>
            <div className="bars">
              {stats.regionRanked.map(([name, n]) => {
                const w = `${(n / stats.maxRegion) * 100}%`;
                return (
                  <div key={name} className="bars__row">
                    <span className="bars__key bars__key--text">{name}</span>
                    <span className="bars__track">
                      <span className="bars__fill" style={{ width: w }} />
                    </span>
                    <span className="bars__value">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {stats.regionAvgRanked.length > 0 && (
            <div className="stats-card">
              <div className="section__title">
                지역 평균 평점 Top {stats.regionAvgRanked.length}
              </div>
              <div className="bars">
                {stats.regionAvgRanked.map((r) => {
                  const w = `${(r.avg / stats.maxRegionAvg) * 100}%`;
                  return (
                    <div key={r.name} className="bars__row">
                      <span className="bars__key bars__key--text">{r.name}</span>
                      <span className="bars__track">
                        <span className="bars__fill" style={{ width: w }} />
                      </span>
                      <span className="bars__value">{r.avg.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {(stats.hardestCafes.length > 0 ||
          stats.scariestCafes.length > 0 ||
          stats.activeCafes.length > 0) && (
          <div className="stats-cafes">
            {stats.hardestCafes.length > 0 && (
              <div className="stats-card">
                <div className="section__title">
                  난이도 평균이 어려운 카페 Top {stats.hardestCafes.length}
                </div>
                <ol className="cafe-rank">
                  {stats.hardestCafes.map((c, i) => (
                    <li key={c.branch} className="cafe-rank__item">
                      <span className="cafe-rank__no">{i + 1}</span>
                      <Link
                        to={`/cafe/${encodeURIComponent(c.branch)}`}
                        className="cafe-rank__name"
                      >
                        {c.branch}
                      </Link>
                      <span className="cafe-rank__meta">
                        난이도 {c.avgDifficulty!.toFixed(1)} / 11 · {c.count}개
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {stats.scariestCafes.length > 0 && (
              <div className="stats-card">
                <div className="section__title">
                  공포도 평균이 높은 카페 Top {stats.scariestCafes.length}
                </div>
                <ol className="cafe-rank">
                  {stats.scariestCafes.map((c, i) => (
                    <li key={c.branch} className="cafe-rank__item">
                      <span className="cafe-rank__no">{i + 1}</span>
                      <Link
                        to={`/cafe/${encodeURIComponent(c.branch)}`}
                        className="cafe-rank__name"
                      >
                        {c.branch}
                      </Link>
                      <span className="cafe-rank__meta">
                        공포 {c.avgFear!.toFixed(1)} / 3 · {c.count}개
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {stats.activeCafes.length > 0 && (
              <div className="stats-card">
                <div className="section__title">
                  활동성 평균이 높은 카페 Top {stats.activeCafes.length}
                </div>
                <ol className="cafe-rank">
                  {stats.activeCafes.map((c, i) => (
                    <li key={c.branch} className="cafe-rank__item">
                      <span className="cafe-rank__no">{i + 1}</span>
                      <Link
                        to={`/cafe/${encodeURIComponent(c.branch)}`}
                        className="cafe-rank__name"
                      >
                        {c.branch}
                      </Link>
                      <span className="cafe-rank__meta">
                        활동 {c.avgActivity!.toFixed(1)} / 3 · {c.count}개
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
