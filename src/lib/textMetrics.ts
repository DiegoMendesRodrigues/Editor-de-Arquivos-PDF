/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
interface FontMetrics {
  a: number;
  d: number;
}

let cached: FontMetrics | null = null;

function fontMetrics(): FontMetrics {
  if (cached) return cached;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.font = '100px Arial, Helvetica, sans-serif';
      const m = ctx.measureText('Hxg');
      const a = m.fontBoundingBoxAscent;
      const d = m.fontBoundingBoxDescent;
      if (a && d) {
        cached = { a: a / 100, d: d / 100 };
        return cached;
      }
    }
  } catch {
    // fallback abaixo
  }
  cached = { a: 0.905, d: 0.212 };
  return cached;
}

export const LINE_HEIGHT = 1.15;

/** Distância (unidades da página) do topo da caixa de linha até a linha de base. */
export function baselineTopOffset(fontSize: number, lineHeight: number = LINE_HEIGHT): number {
  const { a, d } = fontMetrics();
  const halfLeading = (lineHeight - (a + d)) / 2;
  return (halfLeading + a) * fontSize;
}

export function fontFamilyCss(): string {
  return 'Arial, Helvetica, sans-serif';
}
