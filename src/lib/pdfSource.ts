/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';
import type { ImageRegionInfo, PageInfo, Rect, TextItemInfo } from './types';

const BASE = import.meta.env.BASE_URL;

// pdf.worker.js (cópia do build do pdf.js) em vez de ?url: extensão .mjs
// recebe text/plain em hosts como o hcdn e quebra o module worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${BASE}pdf.worker.js`;

export const loadingParams = {
  standardFontDataUrl: `${BASE}standard_fonts/`,
  cMapUrl: `${BASE}cmaps/`,
  cMapPacked: true,
  wasmUrl: `${BASE}wasm/`,
};

export async function openPdf(
  file: File,
): Promise<{ doc: PDFDocumentProxy; bytes: Uint8Array }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ ...loadingParams, data: bytes.slice() }).promise;
  return { doc, bytes };
}

export async function readPageInfo(doc: PDFDocumentProxy, index: number): Promise<PageInfo> {
  const page = await doc.getPage(index + 1);
  const vp: PageViewport = page.getViewport({ scale: 1 });
  return {
    index,
    width: vp.width,
    height: vp.height,
    rotation: vp.rotation,
    transform: [...vp.transform],
  };
}

const DESCENDER_RATIO = 0.25;
const PAD = 1.5;

const applyMat = (m: number[], x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

export async function extractImageRegions(
  doc: PDFDocumentProxy,
  pageIndex: number,
): Promise<ImageRegionInfo[]> {
  const page = await doc.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale: 1 });
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;

  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const found: Rect[] = [];

  const pushRegion = () => {
    const corners: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x, y] of corners) {
      const [ux, uy] = applyMat(ctm, x, y);
      xs.push(ux);
      ys.push(uy);
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const p1 = vp.convertToViewportPoint(minX, minY);
    const p2 = vp.convertToViewportPoint(maxX, maxY);
    const rect: Rect = {
      x: Math.min(p1[0], p2[0]),
      y: Math.min(p1[1], p2[1]),
      w: Math.abs(p2[0] - p1[0]),
      h: Math.abs(p2[1] - p1[1]),
    };
    if (rect.w >= 6 && rect.h >= 6) found.push(rect);
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i] as unknown[];
    switch (fn) {
      case OPS.save:
        stack.push(ctm.slice());
        break;
      case OPS.restore:
        ctm = stack.pop() ?? ctm;
        break;
      case OPS.transform:
        ctm = pdfjsLib.Util.transform(ctm, args as number[]);
        break;
      case OPS.paintFormXObjectBegin: {
        stack.push(ctm.slice());
        const m = args[0];
        if (Array.isArray(m) && m.length === 6) {
          ctm = pdfjsLib.Util.transform(ctm, m as number[]);
        }
        break;
      }
      case OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? ctm;
        break;
      case OPS.paintImageXObject:
      case OPS.paintImageMaskXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintInlineImageXObjectGroup:
        pushRegion();
        break;
      default:
        break;
    }
  }

  const seen = new Set<string>();
  const regions: ImageRegionInfo[] = [];
  found.forEach((rect, i) => {
    const key = [
      Math.round(rect.x),
      Math.round(rect.y),
      Math.round(rect.w),
      Math.round(rect.h),
    ].join('-');
    if (seen.has(key)) return;
    seen.add(key);
    regions.push({ key: `${pageIndex}-img-${i}`, rect });
  });
  return regions;
}

export async function extractTextItems(
  doc: PDFDocumentProxy,
  pageIndex: number,
): Promise<TextItemInfo[]> {
  const page = await doc.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: TextItemInfo[] = [];

  content.items.forEach((raw, i) => {
    if (!('str' in raw) || !raw.str) return;
    const item = raw;
    const tx = pdfjsLib.Util.transform(vp.transform, item.transform as number[]);
    const fontSize = Math.hypot(tx[2], tx[3]);
    if (!Number.isFinite(fontSize) || fontSize < 0.5) return;

    const advLen = Math.hypot(tx[0], tx[1]) || fontSize;
    const adv = { x: (tx[0] / advLen) * item.width, y: (tx[1] / advLen) * item.width };
    const origin = { x: tx[4], y: tx[5] };
    const down = { x: -tx[2] * DESCENDER_RATIO, y: -tx[3] * DESCENDER_RATIO };

    const points = [
      origin,
      { x: origin.x + adv.x, y: origin.y + adv.y },
      { x: origin.x + tx[2], y: origin.y + tx[3] },
      { x: origin.x + adv.x + tx[2], y: origin.y + adv.y + tx[3] },
      { x: origin.x + down.x, y: origin.y + down.y },
      { x: origin.x + adv.x + down.x, y: origin.y + adv.y + down.y },
    ];
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - PAD;
    const maxX = Math.max(...xs) + PAD;
    const minY = Math.min(...ys) - PAD;
    const maxY = Math.max(...ys) + PAD;

    items.push({
      key: `${pageIndex}-${i}`,
      str: item.str,
      rect: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      origin,
      fontSize,
    });
  });

  return items;
}
