/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { extractTextItems } from './pdfSource';
import { baselineTopOffset, LINE_HEIGHT } from './textMetrics';
import type { EditorElement, Rect } from './types';

/** Um trecho de texto reeditável, posicionado em coordenadas da página (view). */
export interface TextRun {
  text: string;
  /** Topo da linha, em unidades da página (origem no canto superior esquerdo). */
  x: number;
  yTop: number;
  sizePt: number;
  bold: boolean;
  /** Hex #rrggbb. */
  color: string;
  /** Largura estimada da linha (unidades da página). */
  widthPt: number;
}

export interface PageTexts {
  pageIndex: number;
  runs: TextRun[];
  /** Retângulos do texto original preservado — precisam ser apagados do PNG. */
  holes: Rect[];
}

/** Cobre o item quando um `erase` ou a caixa de `cover` de um texto toca ≥ 50% dele. */
const coversText = (el: EditorElement): boolean =>
  el.kind === 'erase' || (el.kind === 'text' && Boolean(el.cover));

const coveredFraction = (a: Rect, b: Rect): number => {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  return ((x1 - x0) * (y1 - y0)) / (a.w * a.h || 1);
};

const toHex = (color: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  return m ? m[1].toUpperCase() : '000000';
};

/**
 * Extrai, por página (índice original), o texto original sobrevivente e o texto
 * do usuário como execuções posicionadas — base do DOCX/ODT híbrido (imagem de
 * fundo + textos editáveis por cima).
 */
export async function extractExportTexts(
  doc: PDFDocumentProxy,
  elements: EditorElement[],
  deletedPages: number[],
): Promise<PageTexts[]> {
  const gone = new Set(deletedPages);
  const out: PageTexts[] = [];

  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
    if (gone.has(pageIndex)) continue;
    const pageEls = elements.filter((el) => el.page === pageIndex);
    const covers = pageEls.filter(coversText);
    const runs: TextRun[] = [];
    const holes: Rect[] = [];

    const items = await extractTextItems(doc, pageIndex);
    const raw: TextRun[] = [];
    for (const item of items) {
      const str = item.str.trim();
      if (!str) continue;
      const blocked = covers.some((el) => coveredFraction(item.rect, el.rect) >= 0.5);
      if (blocked) continue;
      holes.push(item.rect);
      raw.push({
        text: item.str,
        x: item.origin.x,
        yTop: item.origin.y - baselineTopOffset(item.fontSize),
        sizePt: item.fontSize,
        bold: false,
        color: '000000',
        widthPt: item.rect.w,
      });
    }

    // Une fragmentos da mesma linha visual (mesma altura, x crescente) —
    // evita molduras/parágrafos separados para o que era uma linha só.
    raw.sort((a, b) => a.yTop - b.yTop || a.x - b.x);
    const lines: TextRun[] = [];
    for (const it of raw) {
      const last = lines[lines.length - 1];
      const sameLine =
        last &&
        Math.abs(it.yTop - last.yTop) < Math.max(it.sizePt, last.sizePt) * 0.6 &&
        it.x >= last.x;
      if (last && sameLine) {
        const gap = it.x - (last.x + last.widthPt);
        last.text += (gap > last.sizePt * 0.25 ? ' ' : '') + it.text;
        last.widthPt = it.x + it.widthPt - last.x;
        last.yTop = Math.min(last.yTop, it.yTop);
      } else {
        lines.push(it);
      }
    }
    runs.push(...lines);

    for (const el of pageEls) {
      if (el.kind !== 'text') continue;
      const size = el.props.fontSize;
      if (!(size > 0) || !el.props.text) continue;
      const color = toHex(el.props.color);
      const lines = el.props.text.split('\n');
      lines.forEach((line, i) => {
        if (!line) return;
        runs.push({
          text: line,
          x: el.origin.x,
          yTop: el.origin.y + i * size * LINE_HEIGHT - baselineTopOffset(size),
          sizePt: size,
          bold: el.props.bold,
          color,
          widthPt: el.rect.w || line.length * size * 0.5,
        });
      });
    }

    out.push({ pageIndex, runs, holes });
  }
  return out;
}
