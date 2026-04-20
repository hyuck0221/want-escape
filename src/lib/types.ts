export type GradeCode =
  | 'S++'
  | 'S+'
  | 'S'
  | 'A+'
  | 'A'
  | 'B+'
  | 'B'
  | 'C+'
  | 'C'
  | 'F'
  | 'X'
  | 'Misc';

export interface DetailedRating {
  total?: number;
  problem?: number | string;
  interior?: number | string;
  story?: number | string;
  creativity?: number | string;
  direction?: number | string;
}

export interface Theme {
  id: string;
  region: string;
  regionGroup?: string;
  branch: string;
  subBranch?: string;
  name: string;
  difficulty: string;
  gradeRaw: string;
  gradeCode: GradeCode;
  gradeRank: number;
  fear?: number;
  activity?: number;
  remark?: string;
  operating: boolean;
  oneLiner?: string;
  escapeTip?: string;
  rating?: DetailedRating;
  reviewLink?: string;
}

export interface SheetMeta {
  sourceTitle: string;
  lastUpdated?: string;
}

export interface ThemeDataset {
  themes: Theme[];
  meta: SheetMeta;
}
