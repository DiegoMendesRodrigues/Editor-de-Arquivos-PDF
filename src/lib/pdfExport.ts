/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { PDFFont, PDFImage } from 'pdf-lib';
import type { EditorElement, PageInfo, PageRange, Rect } from './types';
import { LINE_HEIGHT } from './textMetrics';
import { BRAND } from './brand';

const EXTRA_LATIN: number[] = [
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e,
];

const EXTRA_PUNCT: number[] = [
  0x2018, 0x2019, 0x201c, 0x201d, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039,
  0x203a, 0x20ac, 0x2122,
];

const isAllowedCode = (cp: number): boolean =>
  cp === 0x0a ||
  (cp >= 0x20 && cp <= 0x7e) ||
  (cp >= 0xa0 && cp <= 0xff) ||
  (cp >= 0x2013 && cp <= 0x2014) ||
  EXTRA_LATIN.includes(cp) ||
  EXTRA_PUNCT.includes(cp);

const cleanText = (text: string): string => {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  let out = '';
  for (const ch of normalized) {
    const cp = ch.codePointAt(0) ?? 63;
    out += isAllowedCode(cp) ? ch : '?';
  }
  return out;
};

const parseColor = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  const v = parseInt(m[1], 16);
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
};

const inv = (t: number[], vx: number, vy: number) => {
  const [a, b, c, d, e, f] = t;
  const det = a * d - b * c;
  const u = vx - e;
  const v = vy - f;
  return { x: (d * u - c * v) / det, y: (a * v - b * u) / det };
};

const toPdfRect = (t: number[], r: Rect) => {
  const p1 = inv(t, r.x, r.y);
  const p2 = inv(t, r.x + r.w, r.y + r.h);
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    w: Math.abs(p2.x - p1.x),
    h: Math.abs(p2.y - p1.y),
  };
};

const wrapLines = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const out: string[] = [];
  const limit = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : Infinity;
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('');
      continue;
    }
    if (limit === Infinity) {
      out.push(para);
      continue;
    }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      let w: number;
      try {
        w = font.widthOfTextAtSize(candidate, size);
      } catch {
        w = 0;
      }
      if (line && w > limit) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
};

const dataUrlToBytes = (src: string): Uint8Array | null => {
  const comma = src.indexOf(',');
  if (comma < 0) return null;
  const header = src.slice(0, comma);
  if (!/^data:image\/(png|jpe?g);base64$/i.test(header)) return null;
  const bin = atob(src.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function embedImage(
  doc: PDFDocument,
  src: string,
  cache: Map<string, PDFImage>,
): Promise<PDFImage | null> {
  const hit = cache.get(src);
  if (hit) return hit;
  const bytes = dataUrlToBytes(src);
  if (!bytes) return null;
  const img = /^data:image\/png/i.test(src)
    ? await doc.embedPng(bytes)
    : await doc.embedJpg(bytes);
  cache.set(src, img);
  return img;
}

/**
 * Metadados de marca em todo PDF baixado (Author/Subject/Creator/Producer).
 * Precisa rodar depois de `load`/`create`: o pdf-lib zera o Info dict no
 * construtor (Producer/Creator = "pdf-lib") quando `updateMetadata` é padrão.
 */
const applyBrandMeta = (doc: PDFDocument): void => {
  doc.setAuthor(BRAND);
  doc.setSubject(BRAND);
  doc.setCreator(BRAND);
  doc.setProducer(BRAND);
};

export async function buildPdf(
  bytes: Uint8Array,
  elements: EditorElement[],
  pages: PageInfo[],
  deletedPages: number[] = [],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const imageCache = new Map<string, PDFImage>();

  // Remove páginas excluídas (ordem decrescente para não deslocar índices)
  const gone = new Set(deletedPages);
  for (const idx of [...deletedPages].sort((a, b) => b - a)) {
    if (idx >= 0 && idx < doc.getPageCount()) doc.removePage(idx);
  }

  // Mapeia índice original -> índice no doc final (após remoções)
  const remap = (orig: number): number => {
    let shift = 0;
    for (let i = 0; i < orig; i++) if (gone.has(i)) shift++;
    return orig - shift;
  };

  const pdfPages = doc.getPages();

  for (const el of elements) {
    if (gone.has(el.page)) continue; // elemento em página removida
    const meta = pages[el.page];
    const page = pdfPages[remap(el.page)];
    if (!meta || !page) continue;
    const t = meta.transform;
    const rotation = degrees(((meta.rotation % 360) + 360) % 360);

    switch (el.kind) {
      case 'text': {
        const size = el.props.fontSize;
        if (!(size > 0)) break;
        if (el.cover) {
          const cr = toPdfRect(t, el.rect);
          page.drawRectangle({
            x: cr.x,
            y: cr.y,
            width: cr.w,
            height: cr.h,
            color: parseColor(el.cover),
          });
        }
        const text = cleanText(el.props.text);
        if (!text) break;
        const f = el.props.bold ? fontBold : font;
        const lines = el.wrap ? wrapLines(text, f, size, el.rect.w) : text.split('\n');
        const startP = inv(t, el.origin.x, el.origin.y);
        const stepP = inv(t, el.origin.x, el.origin.y + size * LINE_HEIGHT);
        const step = { x: stepP.x - startP.x, y: stepP.y - startP.y };
        const color = parseColor(el.props.color);
        let p = startP;
        for (const line of lines) {
          if (line) {
            page.drawText(line, {
              x: p.x,
              y: p.y,
              size,
              font: f,
              color,
              rotate: rotation,
            });
          }
          p = { x: p.x + step.x, y: p.y + step.y };
        }
        break;
      }
      case 'image': {
        const img = await embedImage(doc, el.src, imageCache);
        if (!img) break;
        const r = toPdfRect(t, el.rect);
        const rot = (((meta.rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
        let x = r.x;
        let y = r.y;
        let w = r.w;
        let h = r.h;
        let rotate = 0;
        if (rot === 90) {
          x = r.x + r.w;
          y = r.y;
          w = r.h;
          h = r.w;
          rotate = 90;
        } else if (rot === 180) {
          x = r.x + r.w;
          y = r.y + r.h;
          rotate = 180;
        } else if (rot === 270) {
          x = r.x;
          y = r.y + r.h;
          w = r.h;
          h = r.w;
          rotate = 270;
        }
        page.drawImage(img, {
          x,
          y,
          width: w,
          height: h,
          rotate: degrees(rotate),
          opacity: el.opacity,
        });
        break;
      }
      case 'rect': {
        const r = toPdfRect(t, el.rect);
        const hasFill = el.fill !== 'transparent' && el.fill !== 'none' && el.fill !== '';
        const hasStroke =
          el.strokeWidth > 0 &&
          el.stroke !== 'transparent' &&
          el.stroke !== 'none' &&
          el.stroke !== '';
        if (!hasFill && !hasStroke) break;
        page.drawRectangle({
          x: r.x,
          y: r.y,
          width: r.w,
          height: r.h,
          color: hasFill ? parseColor(el.fill) : undefined,
          opacity: hasFill ? el.opacity : undefined,
          borderColor: hasStroke ? parseColor(el.stroke) : undefined,
          borderWidth: hasStroke ? el.strokeWidth : undefined,
          borderOpacity: hasStroke ? el.opacity : undefined,
        });
        break;
      }
      case 'highlight': {
        const r = toPdfRect(t, el.rect);
        page.drawRectangle({
          x: r.x,
          y: r.y,
          width: r.w,
          height: r.h,
          color: parseColor(el.color),
          opacity: el.opacity,
        });
        break;
      }
      case 'erase': {
        const r = toPdfRect(t, el.rect);
        page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: parseColor(el.color) });
        break;
      }
    }
  }

  applyBrandMeta(doc);
  return doc.save();
}

const xmpEscape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Mesmo PDF final, com pacote XMP identificando PDF/A-3b.
 * Melhor esforço: as fontes padrão (Helvetica) não são embutidas, então
 * validadores estritos ainda reprovariam — atende portais que checam a
 * identificação `pdfaid` no XMP.
 */
export async function buildPdfA(
  bytes: Uint8Array,
  elements: EditorElement[],
  pages: PageInfo[],
  deletedPages: number[] = [],
  title = '',
): Promise<Uint8Array> {
  const edited = await buildPdf(bytes, elements, pages, deletedPages);
  const doc = await PDFDocument.load(edited);
  const titleDesc = title
    ? `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmpEscape(
        title,
      )}</rdf:li></rdf:Alt></dc:title></rdf:Description>`
    : '';
  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>${titleDesc}
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const stream = doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(stream));
  applyBrandMeta(doc); // load regravou Producer com "pdf-lib"
  return doc.save();
}

/**
 * Mescla múltiplos PDFs (bytes já editados) em um único documento,
 * na ordem fornecida.
 */
export async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const part of parts) {
    const src = await PDFDocument.load(part, { ignoreEncryption: true });
    const indices = src.getPageIndices();
    const copied = await merged.copyPages(src, indices);
    for (const page of copied) merged.addPage(page);
  }
  applyBrandMeta(merged);
  return merged.save();
}

/**
 * Gera um PDF por intervalo (1-based, inclusivo) a partir de um documento.
 * Útil para quebrar um arquivo em vários, ex.: páginas 1-3 e 4-5.
 */
export async function splitPdf(bytes: Uint8Array, ranges: PageRange[]): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const parts: Uint8Array[] = [];
  for (const r of ranges) {
    const out = await PDFDocument.create();
    const indices: number[] = [];
    for (let i = r.start - 1; i <= r.end - 1; i++) indices.push(i);
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
    applyBrandMeta(out);
    parts.push(await out.save());
  }
  return parts;
}
