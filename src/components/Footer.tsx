import { INSTAGRAM_URL, SHEET_URL, useThemeDataset } from '../lib/dataStore';

export default function Footer() {
  const { data } = useThemeDataset();
  const lastUpdated = data?.meta.lastUpdated;

  return (
    <footer className="site-footer">
      <div className="container site-footer__row">
        <div className="site-footer__block">
          <div className="site-footer__heading">데이터 출처 · Credits</div>
          <p>
            본 페이지의 모든 리뷰와 평점은 인스타그램{' '}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              @want_escape_
            </a>{' '}
            운영자가 직접 플레이한 후 작성한 기록이며, 원본 스프레드시트에서 실시간으로
            불러옵니다. 시트에 데이터가 추가되면 페이지 새로고침만으로 자동 반영됩니다.
          </p>
          <div className="site-footer__links">
            <a className="chip-link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
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
              instagram.com/want_escape_
            </a>
            <a className="chip-link" href={SHEET_URL} target="_blank" rel="noopener noreferrer">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
              원본 스프레드시트
            </a>
          </div>
        </div>
        <div>
          <div className="site-footer__heading">이 사이트에 대하여</div>
          <p>
            @want_escape_ 의 방탈출 리뷰 아카이브입니다.
            <br />
            비영리 팬 페이지이며, 엑셀 원본의 등급 색상을 그대로 사용합니다.
          </p>
          <p className="site-footer__meta">
            {lastUpdated && (
              <>
                최신 업데이트 <strong>{lastUpdated}</strong>
                {' · '}
              </>
            )}
            © {new Date().getFullYear()} want-escape archive
          </p>
        </div>
      </div>
    </footer>
  );
}
