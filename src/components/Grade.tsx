import type { GradeCode } from '../lib/types';

interface Props {
  code: GradeCode;
  size?: 'sm' | 'lg';
}

export default function Grade({ code, size = 'sm' }: Props) {
  return (
    <span className={`grade${size === 'lg' ? ' grade--lg' : ''}`} data-grade={code}>
      {code}
    </span>
  );
}
