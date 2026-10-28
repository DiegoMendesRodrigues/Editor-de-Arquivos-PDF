/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import * as pdfjsLib from 'pdfjs-dist';
import { loadingParams } from './pdfSource';
import type { TextRun } from './textExport';

/** Uma página do PDF final convertida em imagem + textos reeditáveis por cima. */
export interface ExportPage {
  /** Bytes da imagem: PNG (padrão, DOCX/ODT) ou JPEG (download .jpg). */
  bytes: Uint8Array;
  widthPt: number;
  heightPt: number;
  /** Textos (originais sobreviventes + do usuário) como texto editável. */
  texts: TextRun[];
}

export interface RenderOptions {
  /** Padrão PNG; JPEG só no download de imagens .jpg. */
  type?: 'png' | 'jpeg';
  quality?: number;
}

/** 144 DPI: nítido na tela e no impresso, sem inflar demais o arquivo. */
const EXPORT_SCALE = 2;

const canvasToBytes = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          void (async () => {
            try {
              if (blob) {
                resolve(new Uint8Array(await blob.arrayBuffer()));
                return;
              }
              // fallback raro (canvas sujo/tamanho zero): decodifica o dataURL
              const dataUrl = canvas.toDataURL(type, quality);
              const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              resolve(bytes);
            } catch (err) {
              reject(err);
            }
          })();
        },
        type,
        quality,
      );
    } catch (err) {
      reject(err);
    }
  });

/**
 * Renderiza cada página de um PDF (já com edições aplicadas) como imagem.
 * É o que garante fidelidade total (tabelas, cores, imagens, posicionamento)
 * no DOCX/ODT: o documento final embute a imagem da página inteira.
 */
export async function renderPageImages(
  bytes: Uint8Array,
  opts: RenderOptions = {},
): Promise<ExportPage[]> {
  const mime = opts.type === 'jpeg' ? 'image/jpeg' : 'image/png';
  const doc = await pdfjsLib.getDocument({ ...loadingParams, data: bytes.slice() }).promise;
  const pages: ExportPage[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1);
    const viewport = page.getViewport({ scale: EXPORT_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponível');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    pages.push({
      bytes: await canvasToBytes(canvas, mime, opts.quality),
      widthPt: page.getViewport({ scale: 1 }).width,
      heightPt: page.getViewport({ scale: 1 }).height,
      texts: [],
    });
    canvas.width = 0;
    canvas.height = 0;
  }
  return pages;
}
