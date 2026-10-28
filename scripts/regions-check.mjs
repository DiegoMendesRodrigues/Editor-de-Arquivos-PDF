/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { makePng } from './png.mjs';

const png = makePng(100, 100, (x, y) => [Math.min(255, x * 2 + 40), 80, Math.max(0, 220 - y * 2)]);

const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]);
const img = await doc.embedPng(png);
const font = await doc.embedFont(StandardFonts.Helvetica);

page.drawImage(img, { x: 60, y: 480, width: 100, height: 100 });
page.drawText('Imagem de teste', { x: 60, y: 460, size: 14, font, color: rgb(0, 0, 0) });
page.drawImage(img, { x: 300, y: 480, width: 80, height: 80, rotate: degrees(30) });
page.drawImage(img, { x: 420, y: 600, width: 60, height: 40 });
page.drawText('Outro texto', { x: 60, y: 300, size: 18, font, color: rgb(0, 0, 0) });

const bytes = await doc.save();

const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
const d = await task.promise;
const p = await d.getPage(1);
const vp = p.getViewport({ scale: 1 });
const OPS = pdfjs.OPS;
const opList = await p.getOperatorList();

const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

let ctm = [1, 0, 0, 1, 0, 0];
const stack = [];
const regions = [];

const pushRegion = (kind) => {
  const corners = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ].map(([x, y]) => apply(ctm, x, y));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const p1 = vp.convertToViewportPoint(minX, minY);
  const p2 = vp.convertToViewportPoint(maxX, maxY);
  regions.push({
    kind,
    rect: {
      x: +Math.min(p1[0], p2[0]).toFixed(1),
      y: +Math.min(p1[1], p2[1]).toFixed(1),
      w: +Math.abs(p2[0] - p1[0]).toFixed(1),
      h: +Math.abs(p2[1] - p1[1]).toFixed(1),
    },
  });
};

for (let i = 0; i < opList.fnArray.length; i++) {
  const fn = opList.fnArray[i];
  const args = opList.argsArray[i];
  switch (fn) {
    case OPS.save:
      stack.push(ctm.slice());
      break;
    case OPS.restore:
      ctm = stack.pop() ?? ctm;
      break;
    case OPS.transform:
      ctm = pdfjs.Util.transform(ctm, args);
      break;
    case OPS.paintFormXObjectBegin: {
      stack.push(ctm.slice());
      const m = args[0];
      if (Array.isArray(m) && m.length === 6) ctm = pdfjs.Util.transform(ctm, m);
      break;
    }
    case OPS.paintFormXObjectEnd:
      ctm = stack.pop() ?? ctm;
      break;
    case OPS.paintImageXObject:
    case OPS.paintImageMaskXObject:
    case OPS.paintInlineImageXObject:
      pushRegion(fn);
      break;
    default:
      break;
  }
}

console.log('total ops:', opList.fnArray.length);
console.log('regions:', JSON.stringify(regions, null, 2));
console.log('esperado img1: {x:60, y:212, w:100, h:100}');
