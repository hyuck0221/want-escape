import { useState } from 'react';

interface Props {
  url: string;
}

// Strip query string, normalize path, append /embed/
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/(p|reel|tv)\/([^/]+)\/?/);
    if (!m) return null;
    return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`;
  } catch {
    return null;
  }
}

export default function InstagramEmbed({ url }: Props) {
  const embedUrl = toEmbedUrl(url);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!embedUrl) return null;

  return (
    <div className="ig-embed" data-loaded={loaded}>
      {!loaded && !failed && (
        <div className="ig-embed__skeleton" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span>인스타그램 게시물 불러오는 중…</span>
        </div>
      )}
      {failed ? (
        <div className="ig-embed__fallback">
          <p>게시물 미리보기를 불러오지 못했어요.</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="review-link">
            인스타그램에서 직접 보기
          </a>
        </div>
      ) : (
        <iframe
          src={embedUrl}
          title="Instagram 리뷰 게시물"
          loading="lazy"
          scrolling="no"
          allow="encrypted-media"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
