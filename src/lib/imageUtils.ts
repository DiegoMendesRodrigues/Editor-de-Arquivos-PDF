/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
export interface LoadedImage {
  src: string;
  width: number;
  height: number;
}

/** Recorta uma região (coordenadas base da página) do canvas renderizado em PNG. */
export function cropCanvasRegion(
  canvas: HTMLCanvasElement,
  rect: { x: number; y: number; w: number; h: number },
  pageWidth: number,
): string | null {
  if (!canvas.width || !canvas.height || pageWidth <= 0) return null;
  const scale = canvas.width / pageWidth;
  const sx = Math.max(0, Math.round(rect.x * scale));
  const sy = Math.max(0, Math.round(rect.y * scale));
  const sw = Math.min(canvas.width - sx, Math.max(1, Math.round(rect.w * scale)));
  const sh = Math.min(canvas.height - sy, Math.max(1, Math.round(rect.h * scale)));
  if (sw <= 0 || sh <= 0) return null;
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL('image/png');
}

const isRaster = (type: string): boolean => type === 'image/png' || type === 'image/jpeg';

export function isImageFile(file: File): boolean {
  return (
    /^image\//.test(file.type) ||
    /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(file.name)
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato de imagem inválido.'));
    img.src = src;
  });
}

export async function readImageFile(file: File): Promise<LoadedImage> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  if (isRaster(file.type)) {
    return { src: dataUrl, width: img.naturalWidth || 1, height: img.naturalHeight || 1 };
  }

  const width = Math.max(1, Math.min(img.naturalWidth || 512, 4096));
  const height = Math.max(1, Math.min(img.naturalHeight || 512, 4096));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.drawImage(img, 0, 0, width, height);
  return { src: canvas.toDataURL('image/png'), width, height };
}
