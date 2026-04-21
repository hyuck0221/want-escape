import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  clearDatasetCache,
  isCacheEnabled as readCacheEnabled,
  refreshDataset,
  setCacheEnabled as writeCacheEnabled,
} from '../lib/dataStore';
import { useTheme } from '../lib/useTheme';
import { clearFlag, useUserFlags } from '../lib/userState';
import { buildInviteUrl, encodeShareCode } from '../lib/shareCode';

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className="toggle-switch"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-on={checked || undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch__thumb" />
    </button>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const played = useUserFlags('played');
  const wish = useUserFlags('wish');

  const [cacheEnabled, setCacheEnabledState] = useState<boolean>(readCacheEnabled);

  const [shareCode, setShareCode] = useState<string>('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [encoding, setEncoding] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<'url' | null>(null);

  const totalCount = played.size + wish.size;

  // Regenerate share code whenever the user's data changes.
  useEffect(() => {
    if (totalCount === 0) {
      setShareCode('');
      setShareError(null);
      setQrDataUrl('');
      setShowQr(false);
      return;
    }
    let cancelled = false;
    setEncoding(true);
    encodeShareCode({ played: [...played], wish: [...wish] })
      .then((code) => {
        if (cancelled) return;
        setShareCode(code);
        setShareError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setShareCode('');
        setShareError(err instanceof Error ? err.message : '인코딩 실패');
      })
      .finally(() => {
        if (!cancelled) setEncoding(false);
      });
    return () => {
      cancelled = true;
    };
    // Snapshot via played.size + wish.size is enough to detect change; the Set
    // identities themselves never change (the store mutates in place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played.size, wish.size, [...played].join(','), [...wish].join(',')]);

  const inviteUrl = useMemo(() => (shareCode ? buildInviteUrl(shareCode) : ''), [shareCode]);

  // Build QR lazily after the user opens it.
  useEffect(() => {
    if (!showQr || !inviteUrl) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(inviteUrl, { margin: 1, width: 260, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [showQr, inviteUrl]);

  const copy = async (text: string, target: 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget((t) => (t === target ? null : t)), 1500);
    } catch {
      // Fallback for older browsers — just select nothing extra.
    }
  };

  const handleCacheToggle = (enabled: boolean) => {
    writeCacheEnabled(enabled);
    setCacheEnabledState(enabled);
  };

  const handleClearCache = () => {
    if (!window.confirm('스프레드시트 캐시를 지울까요? 다음 방문 시 데이터를 새로 받아옵니다.')) return;
    clearDatasetCache();
    // Immediately refetch so the current session gets fresh data.
    void refreshDataset();
  };

  const handleClearUserData = () => {
    if (totalCount === 0) return;
    if (
      !window.confirm(
        `'해봤어요' ${played.size}개, '관심있어요' ${wish.size}개를 모두 지울까요? 되돌릴 수 없어요.`,
      )
    ) {
      return;
    }
    clearFlag('played');
    clearFlag('wish');
  };

  return (
    <section className="settings">
      <div className="container">
        <header className="detail__header">
          <h1 className="detail__title">설정</h1>
          <div className="detail__branch">화면, 데이터, 공유 옵션을 관리합니다.</div>
        </header>

        <div className="settings-section">
          <div className="settings-section__title">화면</div>
          <div className="settings-row">
            <div className="settings-row__text">
              <div className="settings-row__label">다크 모드</div>
              <p className="settings-row__hint">어두운 배경으로 화면을 바꿉니다.</p>
            </div>
            <Toggle
              checked={theme === 'dark'}
              onChange={(v) => setTheme(v ? 'dark' : 'light')}
              ariaLabel="다크 모드 전환"
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section__title">데이터</div>
          <div className="settings-row">
            <div className="settings-row__text">
              <div className="settings-row__label">스프레드시트 캐싱</div>
              <p className="settings-row__hint">
                데이터를 기기에 저장해 다음 방문 때 빠르게 보여줍니다. 끄면 매번 새로 받아와요.
              </p>
            </div>
            <Toggle
              checked={cacheEnabled}
              onChange={handleCacheToggle}
              ariaLabel="스프레드시트 캐싱 전환"
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section__title">내 데이터 공유</div>
          <p className="settings-row__hint" style={{ marginTop: 0 }}>
            '해봤어요' {played.size}개, '관심있어요' {wish.size}개를 다른 기기로 옮길 수 있어요.
            아래 링크(또는 QR)를 받은 쪽에서 열면 됩니다.
          </p>

          {totalCount === 0 && (
            <p className="settings-empty">
              아직 저장된 '해봤어요'나 '관심있어요'가 없어 공유할 내용이 없습니다.
            </p>
          )}

          {totalCount > 0 && (
            <div className="share-block">
              <div className="share-field">
                <div className="share-field__label">공유 링크</div>
                <div className="share-field__row">
                  <code className="share-code share-code--url">
                    {encoding ? '생성 중…' : shareError ? `오류: ${shareError}` : inviteUrl}
                  </code>
                  <button
                    type="button"
                    className="share-action"
                    disabled={!inviteUrl}
                    onClick={() => copy(inviteUrl, 'url')}
                  >
                    {copiedTarget === 'url' ? '복사됨' : '링크 복사'}
                  </button>
                  <button
                    type="button"
                    className="share-action share-action--ghost"
                    disabled={!inviteUrl}
                    onClick={() => setShowQr((v) => !v)}
                    aria-expanded={showQr}
                  >
                    {showQr ? 'QR 닫기' : 'QR 보기'}
                  </button>
                </div>
              </div>

              {showQr && inviteUrl && (
                <div className="qr-wrap">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="공유 링크 QR 코드" className="qr-wrap__img" />
                  ) : (
                    <div className="qr-wrap__placeholder">QR 생성 중…</div>
                  )}
                  <p className="qr-wrap__caption">
                    다른 기기의 카메라로 스캔하면 공유 페이지가 열립니다.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="settings-section danger-zone">
          <div className="settings-section__title danger-zone__title">위험 구역</div>
          <div className="settings-row">
            <div className="settings-row__text">
              <div className="settings-row__label">스프레드시트 캐시 초기화</div>
              <p className="settings-row__hint">저장된 데이터를 지우고 바로 새로 받아옵니다.</p>
            </div>
            <button type="button" className="danger-btn" onClick={handleClearCache}>
              캐시 지우기
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row__text">
              <div className="settings-row__label">'해봤어요' · '관심있어요' 모두 초기화</div>
              <p className="settings-row__hint">
                저장된 {played.size + wish.size}개를 모두 지웁니다. 되돌릴 수 없으니, 필요하면
                위 공유 코드부터 복사해두세요.
              </p>
            </div>
            <button
              type="button"
              className="danger-btn"
              onClick={handleClearUserData}
              disabled={totalCount === 0}
            >
              모두 지우기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
