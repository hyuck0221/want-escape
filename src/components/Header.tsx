import { Link, NavLink } from 'react-router-dom';
import { INSTAGRAM_URL, SHEET_URL } from '../lib/dataStore';
import { useTheme } from '../lib/useTheme';

export default function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="site-header">
      <div className="container site-header__row">
        <Link to="/" className="brand" aria-label="방탈출을 하고싶어요 홈">
          <img
            src="/logo.png"
            alt=""
            className="brand__logo"
            width={32}
            height={32}
            decoding="async"
          />
          <span>방탈출을 하고싶어요</span>
          <span className="brand__sub">· @want_escape_ archive</span>
        </Link>

        <nav className="site-header__tabs" aria-label="주요 메뉴">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-tab${isActive ? ' nav-tab--active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m3 11 9-8 9 8" />
              <path d="M5 10v10h14V10" />
            </svg>
            <span>홈</span>
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) => `nav-tab${isActive ? ' nav-tab--active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
            </svg>
            <span>통계</span>
          </NavLink>
        </nav>

        <div className="site-header__spacer" />

        <nav className="site-header__links" aria-label="외부 링크">
          <a
            className="chip-link"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="인스타그램에서 원문 리뷰 보기"
            aria-label="Instagram"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            <span className="label-full">Instagram</span>
          </a>
          <a
            className="chip-link"
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="원본 스프레드시트 열기"
            aria-label="Spreadsheet"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
            <span className="label-full">Spreadsheet</span>
          </a>
          <button
            type="button"
            className="icon-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
