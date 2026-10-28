/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import type { PageRange } from './types';
import type { TFunction } from './i18n';

export interface RangeParseResult {
  ranges: PageRange[];
  error: string | null;
}

const RANGE_RE = /^(\d+)(?:\s*-\s*(\d+))?$/;

/** Converte o texto do usuário (um intervalo por linha, ex.: "1-3") em intervalos válidos. */
export function parsePageRanges(text: string, totalPages: number, t: TFunction): RangeParseResult {
  if (!(totalPages > 0)) {
    return { ranges: [], error: t('rangesNoPages') };
  }
  const lines = text.split(/\r?\n/);
  const ranges: PageRange[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const n = i + 1;
    const m = RANGE_RE.exec(line);
    if (!m) {
      return { ranges: [], error: t('rangesBadLine', { n }) };
    }
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    if (end < start) {
      return { ranges: [], error: t('rangesBadOrder', { n, a: start, b: end }) };
    }
    if (start < 1 || end > totalPages) {
      return { ranges: [], error: t('rangesOutOfRange', { n, total: totalPages }) };
    }
    ranges.push({ start, end });
  }
  if (!ranges.length) {
    return { ranges: [], error: t('needRanges') };
  }
  return { ranges, error: null };
}

/** Sugestão inicial: divide o documento ao meio (ex.: 5 páginas -> "1-3" e "4-5"). */
export function defaultRanges(totalPages: number): string {
  if (totalPages <= 1) return '1';
  const half = Math.ceil(totalPages / 2);
  return `1-${half}\n${half + 1}-${totalPages}`;
}
