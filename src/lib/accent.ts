import type { Theme } from './types';

export type AccentKind = 'yellow' | 'red' | 'blue';

export interface Accent {
  kind: AccentKind;
  label: string;
}

// Keyword set that signals "개편 / 일부 수정 / 기간한정 / 삭제" etc.
const MODIFIED_REMARK = /패치|리뉴얼|개편|수정|변경|기간한정|한정|이벤트|삭제|일부/;

export function getAccent(theme: Theme): Accent | null {
  // Priority: blue > red > yellow > default
  const hasModifiedRemark = !!theme.remark && MODIFIED_REMARK.test(theme.remark);
  if (!theme.operating || hasModifiedRemark) {
    const label = !theme.operating
      ? '폐업'
      : theme.remark && /기간한정|한정/.test(theme.remark)
        ? '기간한정'
        : theme.remark && /패치|리뉴얼|개편/.test(theme.remark)
          ? '개편'
          : '수정';
    return { kind: 'blue', label };
  }

  const difficulty = Number(theme.difficulty);
  if (Number.isFinite(difficulty) && difficulty >= 10) {
    return { kind: 'red', label: '고난이도' };
  }

  if (theme.gradeCode === 'S++' || theme.gradeCode === 'S+' || theme.gradeCode === 'S') {
    return { kind: 'yellow', label: '추천' };
  }

  return null;
}
