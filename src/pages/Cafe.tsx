import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import ThemeCard from '../components/ThemeCard';
import { useThemeDataset } from '../lib/dataStore';
import type { Theme } from '../lib/types';

function avg(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export default function Cafe() {
  const { branch = '' } = useParams();
  const decoded = decodeURIComponent(branch);
  const { status, data } = useThemeDataset();

  const themes: Theme[] = useMemo(() => {
    if (!data) return [];
    return data.themes
      .filter((t) => t.branch === decoded)
      .sort((a, b) => {
        if (a.operating !== b.operating) return a.operating ? -1 : 1;
        if (a.gradeRank !== b.gradeRank) return a.gradeRank - b.gradeRank;
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [data, decoded]);

  const operatingCount = themes.filter((t) => t.operating).length;
  const closedCount = themes.length - operatingCount;
  const regions = Array.from(new Set(themes.map((t) => t.region).filter(Boolean)));
  const totalRatingAvg = avg(
    themes.map((t) => t.rating?.total).filter((v): v is number => typeof v === 'number'),
  );
  const difficultyAvg = avg(
    themes
      .map((t) => Number(t.difficulty))
      .filter((n) => Number.isFinite(n) && n > 0),
  );

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

  if (themes.length === 0) {
    return (
      <section className="detail">
        <div className="container">
          <div className="state">
            <h3>해당 카페의 테마를 찾을 수 없어요</h3>
            <p>
              <Link to="/" style={{ textDecoration: 'underline' }}>
                전체 목록으로 돌아가기
              </Link>
            </p>
          </div>
        </div>
      </section>
    );
  }

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
            <span className="region-tag">카페</span>
            {regions.map((r) => (
              <span key={r}>· {r}</span>
            ))}
          </div>
          <h1 className="detail__title">{decoded}</h1>
          <div className="detail__branch">
            총 {themes.length}개 테마
            {operatingCount > 0 && ` · 운영중 ${operatingCount}`}
            {closedCount > 0 && ` · 폐업/종료 ${closedCount}`}
          </div>
        </header>

        <div className="cafe-stats">
          <div className="cafe-stat">
            <span className="cafe-stat__label">평균 종합 평점</span>
            <span className="cafe-stat__value">
              {totalRatingAvg != null ? totalRatingAvg.toFixed(2) : '—'}
            </span>
          </div>
          <div className="cafe-stat">
            <span className="cafe-stat__label">평균 난이도</span>
            <span className="cafe-stat__value">
              {difficultyAvg != null ? difficultyAvg.toFixed(1) : '—'}
            </span>
          </div>
          <div className="cafe-stat">
            <span className="cafe-stat__label">리뷰된 테마</span>
            <span className="cafe-stat__value">{themes.length}</span>
          </div>
        </div>

        <section className="related" style={{ marginTop: 24 }}>
          <div className="related__head">
            <h2 className="related__title">이 카페의 테마</h2>
            <span className="related__caption">추천도 순</span>
          </div>
          <div className="grid">
            {themes.map((t) => (
              <ThemeCard key={t.id} theme={t} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
