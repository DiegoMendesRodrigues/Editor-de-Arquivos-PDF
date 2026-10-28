/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]);
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText('Teste 123', { x: 50, y: 700, size: 24, font, color: rgb(0, 0, 0) });
page.drawRectangle({ x: 45, y: 695, width: 120, height: 35, borderColor: rgb(1, 0, 0), borderWidth: 1 });
const bytes = await doc.save();

const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
const d = await task.promise;
const p = await d.getPage(1);

for (const rot of [0, 90, 180, 270]) {
  const vp = p.getViewport({ scale: 1, rotation: rot });
  console.log(
    'rot', rot,
    'size', vp.width.toFixed(1), vp.height.toFixed(1),
    'transform', vp.transform.map((n) => +n.toFixed(4)).join(','),
  );
}

const vp0 = p.getViewport({ scale: 1 });
const inv = (t, vx, vy) => {
  const [a, b, c, d, e, f] = t;
  const det = a * d - b * c;
  const u = vx - e;
  const v = vy - f;
  return { x: (d * u - c * v) / det, y: (a * v - b * u) / det };
};
const fwd = (t, px, py) => {
  const [a, b, c, d, e, f] = t;
  return { x: a * px + c * py + e, y: b * px + d * py + f };
};
console.log('roundtrip pdf(50,700):', JSON.stringify(inv(vp0.transform, ...Object.values(fwd(vp0.transform, 50, 700)).map((v) => +v.toFixed(6)))));

const tc = await p.getTextContent();
for (const it of tc.items) {
  if (!('str' in it) || !it.str) continue;
  const tx = pdfjs.Util.transform(vp0.transform, it.transform);
  console.log(
    JSON.stringify({
      str: it.str,
      width: +it.width.toFixed(3),
      height: +it.height.toFixed(3),
      rawTransform: it.transform.map((n) => +n.toFixed(3)),
      viewportTx: tx.map((n) => +n.toFixed(3)),
    }),
  );
  const fontSize = Math.hypot(tx[2], tx[3]);
  const advLen = Math.hypot(tx[0], tx[1]) || 1;
  const adv = { x: (tx[0] / advLen) * it.width, y: (tx[1] / advLen) * it.width };
  const O = { x: tx[4], y: tx[5] };
  const A = { x: O.x + adv.x, y: O.y + adv.y };
  const U = { x: O.x + tx[2], y: O.y + tx[3] };
  const corners = [O, A, U, { x: A.x + tx[2], y: A.y + tx[3] }];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  console.log('  computed rect:', JSON.stringify({
    x: +Math.min(...xs).toFixed(2),
    y: +Math.min(...ys).toFixed(2),
    w: +(Math.max(...xs) - Math.min(...xs)).toFixed(2),
    h: +(Math.max(...ys) - Math.min(...ys)).toFixed(2),
    baseline: +O.y.toFixed(2),
    fontSize: +fontSize.toFixed(2),
  }));
}
await d.destroy();
