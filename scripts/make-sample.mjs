/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { makePng } from './png.mjs';

const outDir = new URL('../public/e2e/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const imgPng = makePng(100, 100, (x, y) => [
  Math.min(255, x * 2 + 40),
  80,
  Math.max(0, 220 - y * 2),
]);
const logoPng = makePng(120, 90, (x, y) => {
  const inCircle = (x - 60) ** 2 + (y - 45) ** 2 < 35 ** 2;
  return inCircle ? [30, 144, 255] : [240, 240, 245];
});

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const img = await doc.embedPng(imgPng);
const logo = await doc.embedPng(logoPng);

const page1 = doc.addPage([612, 792]);
page1.drawText('Texto original de teste 123', {
  x: 60,
  y: 700,
  size: 20,
  font: bold,
  color: rgb(0.1, 0.1, 0.15),
});
page1.drawText('Este paragrafo sera apagado pelo borracha', {
  x: 60,
  y: 400,
  size: 16,
  font,
  color: rgb(0, 0, 0),
});
page1.drawImage(img, { x: 60, y: 480, width: 100, height: 100 });
page1.drawText('Imagem de teste', { x: 60, y: 460, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
page1.drawText('Outro conteudo na pagina 1', {
  x: 60,
  y: 200,
  size: 14,
  font,
  color: rgb(0.2, 0.2, 0.2),
});

const page2 = doc.addPage([612, 792]);
page2.drawText('Pagina 2 - conteudo do segundo texto', {
  x: 60,
  y: 700,
  size: 20,
  font: bold,
  color: rgb(0.1, 0.1, 0.15),
});
page2.drawImage(logo, { x: 300, y: 500, width: 120, height: 90 });

const bytes = await doc.save();
writeFileSync(new URL('sample.pdf', outDir), bytes);

// PDF separado para testar abas/limite, com conteúdo distinto
const doc2 = await PDFDocument.create();
const p2a = doc2.addPage([612, 792]);
p2a.drawText('Conteudo exclusivo do terceiro documento', {
  x: 60,
  y: 700,
  size: 20,
  font: bold,
  color: rgb(0.1, 0.1, 0.15),
});
p2a.drawText('Segmento de teste para isolamento de abas', {
  x: 60,
  y: 660,
  size: 14,
  font,
  color: rgb(0.2, 0.2, 0.2),
});
writeFileSync(new URL('sample-b.pdf', outDir), await doc2.save());

writeFileSync(new URL('test-image.png', outDir), makePng(80, 80, (x, y) => [x * 3, 200 - y * 2, 90]));
console.log('sample PDFs + imagem gerados em public/e2e/');
