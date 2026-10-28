/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'pdfjs-dist');
const dest = path.join(root, 'public');
const dirs = ['standard_fonts', 'cmaps', 'wasm'];

mkdirSync(dest, { recursive: true });
for (const dir of dirs) {
  const from = path.join(src, dir);
  if (existsSync(from)) {
    cpSync(from, path.join(dest, dir), { recursive: true });
  }
}

// O worker vai como .js: hosts como o hcdn do Hostinger servem .mjs com
// text/plain e o navegador recusa module scripts/worker com MIME inválido.
const worker = path.join(src, 'build', 'pdf.worker.mjs');
if (existsSync(worker)) {
  cpSync(worker, path.join(dest, 'pdf.worker.js'));
}
console.log('Assets do pdf.js copiados para public/ (standard_fonts, cmaps, wasm, pdf.worker.js).');
