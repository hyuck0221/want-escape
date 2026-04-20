import * as XLSX from 'xlsx';
import type { DetailedRating, GradeCode, Theme, ThemeDataset } from './types';

const SHEET_NAMES = {
  operatingByGrade: '추천도 순 정렬(운영중)',
  operatingByRegion: '지역 순 정렬(운영중)',
  detailedRatings: '추천도 세부 평점(폐업 매장 포함)',
  oneLiners: '한줄평(폐업 매장 포함)',
  allByGrade: '추천도 순 정렬(폐업 매장 포함)',
} as const;

const GRADE_RANK: Record<GradeCode, number> = {
  'S++': 0,
  'S+': 1,
  S: 2,
  'A+': 3,
  A: 4,
  'B+': 5,
  B: 6,
  'C+': 7,
  C: 8,
  F: 9,
  X: 10,
  Misc: 99,
};

// "(0)S++" -> { rank: 0, code: 'S++' }
function parseGrade(raw: unknown): { rank: number; code: GradeCode; raw: string } {
  const str = raw == null ? '' : String(raw).trim();
  if (!str) return { rank: 99, code: 'Misc', raw: '' };
  const m = str.match(/\(([^)]+)\)\s*(.+)/);
  if (m) {
    const codePart = m[2].trim() as GradeCode;
    const rank = GRADE_RANK[codePart] ?? 99;
    return { rank, code: codePart, raw: str };
  }
  const normalized = str as GradeCode;
  return { rank: GRADE_RANK[normalized] ?? 99, code: normalized, raw: str };
}

// "●0" -> 0, "●1" -> 1, null -> undefined
function parseDots(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const str = String(raw);
  const m = str.match(/(\d)/);
  if (m) return Number(m[1]);
  return undefined;
}

function cleanString(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).trim();
}

function toDisplayDifficulty(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number') return String(raw);
  const str = String(raw).trim();
  // "7.0" -> "7"
  const num = Number(str);
  if (!Number.isNaN(num) && /^\d+(\.\d+)?$/.test(str)) {
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
  }
  return str;
}

function normalizeId(raw: unknown): string {
  if (raw == null) return '';
  const str = String(raw).trim();
  // [287] -> 287
  const m = str.match(/\[([^\]]+)\]/);
  return m ? m[1] : str;
}

function getCellHyperlink(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  colIndex: number,
  dataRowIndex: number,
): string | undefined {
  const addr = XLSX.utils.encode_cell({ r: headerRow + 1 + dataRowIndex, c: colIndex });
  const cell = sheet[addr];
  if (cell && cell.l && cell.l.Target) return String(cell.l.Target);
  return undefined;
}

function rowsFromSheet(sheet: XLSX.WorkSheet, headerRow: number): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRow,
    defval: '',
    raw: true,
  });
}

function headerColumnIndex(sheet: XLSX.WorkSheet, headerRow: number, headerName: string): number {
  const ref = sheet['!ref'];
  if (!ref) return -1;
  const range = XLSX.utils.decode_range(ref);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = sheet[addr];
    if (cell && cleanString(cell.v) === headerName) return c;
  }
  return -1;
}

export function parseWorkbook(buffer: ArrayBuffer): ThemeDataset {
  const wb = XLSX.read(buffer, { type: 'array', cellHTML: false, cellFormula: false });

  const operatingSheet = wb.Sheets[SHEET_NAMES.operatingByGrade];
  const regionSheet = wb.Sheets[SHEET_NAMES.operatingByRegion];
  const detailSheet = wb.Sheets[SHEET_NAMES.detailedRatings];
  const oneLinerSheet = wb.Sheets[SHEET_NAMES.oneLiners];
  const allSheet = wb.Sheets[SHEET_NAMES.allByGrade];

  const operatingHeaderRow = 1; // zero-indexed
  const regionHeaderRow = 1;
  const detailHeaderRow = 1;
  const oneLinerHeaderRow = 1;
  const allHeaderRow = 1;

  // Build lookup maps first (keyed by normalized id)
  const regionMap = new Map<string, { major?: string; minor?: string }>();
  if (regionSheet) {
    const rows = rowsFromSheet(regionSheet, regionHeaderRow);
    for (const r of rows) {
      const id = normalizeId(r['번호']);
      if (!id) continue;
      regionMap.set(id, {
        major: cleanString(r['대분류']) || undefined,
        minor: cleanString(r['소분류']) || undefined,
      });
    }
  }

  const ratingMap = new Map<string, DetailedRating>();
  if (detailSheet) {
    const rows = rowsFromSheet(detailSheet, detailHeaderRow);
    for (const r of rows) {
      const id = normalizeId(r['번호']);
      if (!id) continue;
      const total = Number(r['평점']);
      ratingMap.set(id, {
        total: Number.isFinite(total) ? total : undefined,
        problem: r['문제'] === '' ? undefined : r['문제'] as number | string,
        interior: r['인테리어'] === '' ? undefined : (r['인테리어'] as number | string),
        story: r['스토리'] === '' ? undefined : (r['스토리'] as number | string),
        creativity: r['창의성'] === '' ? undefined : (r['창의성'] as number | string),
        direction: r['연출'] === '' ? undefined : (r['연출'] as number | string),
      });
    }
  }

  const oneLinerMap = new Map<string, { oneLiner?: string; tip?: string }>();
  if (oneLinerSheet) {
    const rows = rowsFromSheet(oneLinerSheet, oneLinerHeaderRow);
    for (const r of rows) {
      const id = normalizeId(r['번호']);
      if (!id) continue;
      oneLinerMap.set(id, {
        oneLiner: cleanString(r['한줄평']) || undefined,
        tip: cleanString(r['탈출 팁!']) || undefined,
      });
    }
  }

  // Operating themes - primary list with hyperlinks
  const themes: Theme[] = [];
  const seenIds = new Set<string>();

  if (operatingSheet) {
    const nameCol = headerColumnIndex(operatingSheet, operatingHeaderRow, '테마명');
    const rows = rowsFromSheet(operatingSheet, operatingHeaderRow);
    rows.forEach((r, idx) => {
      const id = normalizeId(r['번호']);
      if (!id) return;
      const name = cleanString(r['테마명']);
      if (!name) return;
      const grade = parseGrade(r['추천도']);
      const regionInfo = regionMap.get(id);
      const rating = ratingMap.get(id);
      const oneLiner = oneLinerMap.get(id);
      const hyperlink =
        nameCol >= 0
          ? getCellHyperlink(operatingSheet, operatingHeaderRow, nameCol, idx)
          : undefined;

      themes.push({
        id,
        region: cleanString(r['지역']) || regionInfo?.minor || '',
        regionGroup: regionInfo?.major,
        branch: cleanString(r['지점명']),
        subBranch: cleanString(r['호점']) || undefined,
        name,
        difficulty: toDisplayDifficulty(r['난이도']),
        gradeRaw: grade.raw,
        gradeCode: grade.code,
        gradeRank: grade.rank,
        fear: parseDots(r['공포도']),
        activity: parseDots(r['활동성']),
        remark: cleanString(r['비고']) || undefined,
        operating: true,
        oneLiner: oneLiner?.oneLiner,
        escapeTip: oneLiner?.tip,
        rating,
        reviewLink: hyperlink,
      });
      seenIds.add(id);
    });
  }

  // Closed themes - include ones not already in operating
  if (allSheet) {
    const nameCol = headerColumnIndex(allSheet, allHeaderRow, '테마명');
    const rows = rowsFromSheet(allSheet, allHeaderRow);
    rows.forEach((r, idx) => {
      const id = normalizeId(r['번호']);
      if (!id || seenIds.has(id)) return;
      const name = cleanString(r['테마명']);
      if (!name) return;
      const grade = parseGrade(r['추천도']);
      const regionInfo = regionMap.get(id);
      const rating = ratingMap.get(id);
      const oneLiner = oneLinerMap.get(id);
      const hyperlink =
        nameCol >= 0
          ? getCellHyperlink(allSheet, allHeaderRow, nameCol, idx)
          : undefined;
      const remark = cleanString(r['비고']) || undefined;
      const isClosed = !!remark && /폐업/.test(remark);

      themes.push({
        id,
        region: cleanString(r['지역']) || regionInfo?.minor || '',
        regionGroup: regionInfo?.major,
        branch: cleanString(r['지점명']),
        subBranch: cleanString(r['호점']) || undefined,
        name,
        difficulty: toDisplayDifficulty(r['난이도']),
        gradeRaw: grade.raw,
        gradeCode: grade.code,
        gradeRank: grade.rank,
        fear: parseDots(r['공포도']),
        activity: parseDots(r['활동성']),
        remark,
        operating: !isClosed,
        oneLiner: oneLiner?.oneLiner,
        escapeTip: oneLiner?.tip,
        rating,
        reviewLink: hyperlink,
      });
      seenIds.add(id);
    });
  }

  // Derive last-updated label from title row of operating sheet if present
  let lastUpdated: string | undefined;
  if (operatingSheet) {
    const titleRow: unknown[] = [];
    const ref = operatingSheet['!ref'];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        titleRow.push(operatingSheet[addr]?.v);
      }
    }
    const numberCell = titleRow.find((v) => typeof v === 'number' && v > 200000 && v < 300000);
    if (typeof numberCell === 'number') {
      const s = String(Math.round(numberCell));
      if (s.length === 6) {
        lastUpdated = `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
      }
    }
  }

  return {
    themes,
    meta: {
      sourceTitle: '방탈출을 하고싶어요',
      lastUpdated,
    },
  };
}
