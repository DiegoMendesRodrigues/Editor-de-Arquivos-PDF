/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import type { Point, Rect } from './types';

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const normRect = (x1: number, y1: number, x2: number, y2: number): Rect => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  w: Math.abs(x2 - x1),
  h: Math.abs(y2 - y1),
});

export const rectFromRect = (r: Rect): Rect => normRect(r.x, r.y, r.x + r.w, r.y + r.h);

export const rectContains = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const clampRectToPage = (r: Rect, pageW: number, pageH: number): Rect => {
  const w = Math.min(r.w, pageW);
  const h = Math.min(r.h, pageH);
  return {
    x: clamp(r.x, 0, pageW - w),
    y: clamp(r.y, 0, pageH - h),
    w,
    h,
  };
};

export const translateRect = (r: Rect, dx: number, dy: number): Rect => ({
  ...r,
  x: r.x + dx,
  y: r.y + dy,
});

export const movePoint = (p: Point, dx: number, dy: number): Point => ({ x: p.x + dx, y: p.y + dy });

export const MIN_DRAG = 6;
