/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import type { Rect } from './types';

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export interface RegionColors {
  bg: string;
  fg: string;
}

export function sampleRegionColors(
  canvas: HTMLCanvasElement,
  rect: Rect,
  scale: number,
): RegionColors {
  const fallback: RegionColors = { bg: '#ffffff', fg: '#000000' };
  if (!canvas.width || !canvas.height || scale <= 0) return fallback;

  const x0 = Math.max(0, Math.floor(rect.x * scale));
  const y0 = Math.max(0, Math.floor(rect.y * scale));
  const x1 = Math.min(canvas.width, Math.ceil((rect.x + rect.w) * scale));
  const y1 = Math.min(canvas.height, Math.ceil((rect.y + rect.h) * scale));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return fallback;

  let data: Uint8ClampedArray;
  try {
    data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(x0, y0, w, h).data;
  } catch {
    return fallback;
  }

  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const total = w * h;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = counts.get(key);
    if (bucket) {
      bucket.n++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      counts.set(key, { n: 1, r, g, b });
    }
  }

  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bucket of counts.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }
  if (!best) return fallback;
  const bg = { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n };
  const bgHex = toHex(bg.r, bg.g, bg.b);

  let maxDist = 0;
  let fg = { r: 0, g: 0, b: 0 };
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const dr = data[o] - bg.r;
    const dg = data[o + 1] - bg.g;
    const db = data[o + 2] - bg.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist > maxDist) {
      maxDist = dist;
      fg = { r: data[o], g: data[o + 1], b: data[o + 2] };
    }
  }
  const fgHex = maxDist > 45 * 45 ? toHex(fg.r, fg.g, fg.b) : '#000000';
  return { bg: bgHex, fg: fgHex };
}
