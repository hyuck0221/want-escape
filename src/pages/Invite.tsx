import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useThemeDataset } from '../lib/dataStore';
import { applyFlags, useUserFlags } from '../lib/userState';
import { decodeShareCode, type ShareData } from '../lib/shareCode';
import Grade from '../components/Grade';
import type { Theme } from '../lib/types';

type Stage = 'preview' | 'choose-mode' | 'done' | 'error';

interface PreviewItem {
  id: string;
  state: 'played' | 'wish' | 'both';
  theme?: Theme;
}

// Share-code IDs are plain numeric strings ("88"), but the dataset's canonical
// IDs may be zero-padded to match the spreadsheet formatting ("088"). We resolve
// each decoded ID against the loaded dataset so UI lookups and persisted flags
// both use the canonical form.
function buildCanonicalMap(themes: Theme[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const t of themes) {
    const n = Number(t.id);
    if (Number.isInteger(n)) m.set(n, t.id);
  }
  return m;
}

function canonicalize(id: string, canonical: Map<number, string>): string {
  const n = Number(id);
  if (!Number.isInteger(n)) return id;
  return canonical.get(n) ?? id;
}

function resolveShareData(data: ShareData, themes: Theme[]): ShareData {
  const canonical = buildCanonicalMap(themes);
  return {
    played: data.played.map((id) => canonicalize(id, canonical)),
    wish: data.wish.map((id) => canonicalize(id, canonical)),
  };
}

function buildPreview(data: ShareData, themes: Theme[]): PreviewItem[] {
  const resolved = resolveShareData(data, themes);
  const map = new Map<string, PreviewItem>();
  for (const id of resolved.played) map.set(id, { id, state: 'played' });
  for (const id of resolved.wish) {
    const existing = map.get(id);
    map.set(id, { id, state: existing ? 'both' : 'wish' });
  }
  const themeById = new Map(themes.map((t) => [t.id, t]));
  return [...map.values()]
    .map((p) => ({ ...p, theme: themeById.get(p.id) }))
    .sort((a, b) => {
      // known-theme first, then by grade rank, then by id asc
      if (!!a.theme !== !!b.theme) return a.theme ? -1 : 1;
      const ra = a.theme?.gradeRank ?? 999;
      const rb = b.theme?.gradeRank ?? 999;
      if (ra !== rb) return ra - rb;
      return Number(a.id) - Number(b.id);
    });
}

const AUTO_HOME_MS = 5000;

function AutoHomeButton({ onGo }: { onGo: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onGo, AUTO_HOME_MS);
    return () => window.clearTimeout(id);
  }, [onGo]);
  return (
    <button
      type="button"
      className="detail-action invite-confirm invite-auto-home"
      onClick={onGo}
    >
      <span className="invite-auto-home__label">홈으로</span>
    </button>
  );
}

function StateChip({ state }: { state: PreviewItem['state'] }) {
  if (state === 'played') return <span className="invite-chip invite-chip--played">해봤어요</span>;
  if (state === 'wish') return <span className="invite-chip invite-chip--wish">관심있어요</span>;
  return (
    <span className="invite-chip invite-chip--both">
      해봤어요 <span aria-hidden>·</span> 관심있어요
    </span>
  );
}

export default function Invite() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { status, data } = useThemeDataset();
  const existingPlayed = useUserFlags('played');
  const existingWish = useUserFlags('wish');

  const [decoded, setDecoded] = useState<ShareData | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('preview');
  const [appliedMode, setAppliedMode] = useState<'replace' | 'merge' | null>(null);

  const hasExistingData = existingPlayed.size + existingWish.size > 0;

  useEffect(() => {
    let cancelled = false;
    setDecoded(null);
    setDecodeError(null);
    setStage('preview');
    setAppliedMode(null);
    if (!code) {
      setDecodeError('초대 코드가 비어 있습니다.');
      setStage('error');
      return;
    }
    decodeShareCode(code)
      .then((result) => {
        if (cancelled) return;
        setDecoded(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDecodeError(err instanceof Error ? err.message : '코드를 해석할 수 없습니다');
        setStage('error');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const items = useMemo(() => {
    if (!decoded) return [];
    return buildPreview(decoded, data?.themes ?? []);
  }, [decoded, data]);

  const summary = useMemo(() => {
    if (!decoded) return { played: 0, wish: 0, total: 0 };
    const played = decoded.played.length;
    const wish = decoded.wish.length;
    const both = decoded.played.filter((id) => decoded.wish.includes(id)).length;
    return { played, wish, both, total: played + wish - both };
  }, [decoded]);

  const apply = (mode: 'replace' | 'merge') => {
    if (!decoded) return;
    const resolved = resolveShareData(decoded, data?.themes ?? []);
    applyFlags(resolved, mode);
    setAppliedMode(mode);
    setStage('done');
  };

  const handleConfirm = () => {
    if (!decoded) return;
    if (hasExistingData) {
      setStage('choose-mode');
      return;
    }
    apply('merge'); // empty on either side → merge == replace
  };

  // ---------- render branches ----------
  if (stage === 'error' || decodeError) {
    return (
      <section className="detail">
        <div className="container">
          <Link to="/" className="detail__back">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
            전체 목록
          </Link>
          <header className="detail__header">
            <h1 className="detail__title">초대 코드를 읽을 수 없어요</h1>
            <div className="detail__branch">{decodeError ?? '알 수 없는 오류'}</div>
          </header>
          <p className="settings-row__hint">
            코드를 주고받는 도중에 잘려서 전달됐거나, 이 버전에서 지원하지 않는 형식일 수 있어요.
            원본 링크를 다시 확인해 주세요.
          </p>
        </div>
      </section>
    );
  }

  if (stage === 'done') {
    return (
      <section className="detail">
        <div className="container">
          <header className="detail__header">
            <h1 className="detail__title">등록 완료</h1>
            <div className="detail__branch">
              {appliedMode === 'replace'
                ? '기존 데이터를 덮어쓰고 새 데이터를 적용했습니다.'
                : '기존 데이터에 새 항목을 합쳤습니다.'}
            </div>
          </header>
          <p className="settings-row__hint">5초 뒤 자동으로 홈으로 이동합니다.</p>
          <div className="invite-actions">
            <AutoHomeButton onGo={() => navigate('/', { replace: true })} />
          </div>
        </div>
      </section>
    );
  }

  if (!decoded) {
    return (
      <section className="detail">
        <div className="container">
          <div className="state">
            <h3>초대 코드 해석 중…</h3>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="detail">
      <div className="container">
        <Link to="/" className="detail__back">
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
          전체 목록
        </Link>

        <header className="detail__header">
          <h1 className="detail__title">초대 코드 미리보기</h1>
          <div className="detail__branch">
            등록될 항목: 총 <strong>{summary.total}</strong>개
            {summary.both ? ` (겹침 ${summary.both}개)` : ''} · 해봤어요 {summary.played}개 · 관심있어요 {summary.wish}개
          </div>
        </header>

        {status !== 'ready' ? (
          <p className="settings-row__hint">데이터 불러오는 중…</p>
        ) : (
          <div className="invite-list">
            {items.map((item) => (
              <div
                key={item.id}
                className={`invite-list__row${item.theme ? '' : ' invite-list__row--unknown'}`}
              >
                <span className="invite-list__id">#{item.id}</span>
                {item.theme ? (
                  <>
                    <span className="invite-list__grade">
                      <Grade code={item.theme.gradeCode} />
                    </span>
                    <span className="invite-list__name">{item.theme.name}</span>
                    <span className="invite-list__meta">
                      {item.theme.branch}
                      {item.theme.region ? ` · ${item.theme.region}` : ''}
                    </span>
                  </>
                ) : (
                  <span className="invite-list__name invite-list__name--unknown">
                    (이 기기의 테마 목록에 없음)
                  </span>
                )}
                <StateChip state={item.state} />
              </div>
            ))}
          </div>
        )}

        {stage === 'preview' && (
          <div className="invite-cta">
            <p className="settings-row__hint">
              {status !== 'ready'
                ? '테마 목록을 불러오는 중입니다. 잠시 후 확인 버튼이 활성화돼요.'
                : hasExistingData
                  ? `이 기기에는 이미 '해봤어요' ${existingPlayed.size}개, '관심있어요' ${existingWish.size}개가 저장되어 있어요. 확인을 누르면 처리 방식을 다시 여쭤볼게요.`
                  : '아래 확인을 누르면 위 목록이 이 기기에 등록됩니다.'}
            </p>
            <div className="invite-actions">
              <button
                type="button"
                className="detail-action invite-confirm"
                onClick={handleConfirm}
                disabled={status !== 'ready'}
              >
                확인
              </button>
              <Link to="/" className="detail-action">취소</Link>
            </div>
          </div>
        )}

        {stage === 'choose-mode' && (
          <div className="invite-warning">
            <div className="invite-warning__title">⚠️ 기존 데이터가 있어요</div>
            <p className="invite-warning__body">
              이 기기에 저장된 '해봤어요' <strong>{existingPlayed.size}</strong>개,
              '관심있어요' <strong>{existingWish.size}</strong>개를 어떻게 할까요?
            </p>
            <ul className="invite-warning__list">
              <li>
                <strong>변경</strong>: 기존 데이터를 전부 지우고 초대 코드의 내용만 남깁니다.
                되돌릴 수 없어요.
              </li>
              <li>
                <strong>합치기</strong>: 기존 데이터는 그대로 두고 초대 코드의 항목을 추가로 등록합니다.
              </li>
              <li>
                <strong>취소</strong>: 아무것도 바꾸지 않고 돌아갑니다.
              </li>
            </ul>
            <div className="invite-actions">
              <button
                type="button"
                className="danger-btn"
                onClick={() => {
                  if (
                    window.confirm(
                      `정말 기존 데이터 ${existingPlayed.size + existingWish.size}개를 모두 지우고 새 데이터로 덮어쓸까요?`,
                    )
                  ) {
                    apply('replace');
                  }
                }}
              >
                변경 (덮어쓰기)
              </button>
              <button type="button" className="detail-action invite-confirm" onClick={() => apply('merge')}>
                합치기
              </button>
              <button type="button" className="detail-action" onClick={() => setStage('preview')}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
