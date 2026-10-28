/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { unzipSync } from 'fflate';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173/';
const SHOTS = fileURLToPath(new URL('../e2e/shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const BRAND = 'Editor de PDF - pdf.aplicativoia.online';

// Confere Author/Subject/Creator/Producer de um PDF carregado no pdf.js.
const assertBrandMeta = (info, label) => {
  assert(info?.Author === BRAND, `${label}: Author é a marca (veio "${info?.Author}")`);
  assert(info?.Subject === BRAND, `${label}: Subject é a marca (veio "${info?.Subject}")`);
  assert(info?.Creator === BRAND, `${label}: Creator é a marca (veio "${info?.Creator}")`);
  assert(info?.Producer === BRAND, `${label}: Producer é a marca (veio "${info?.Producer}")`);
};

if (!existsSync(new URL('../public/e2e/sample.pdf', import.meta.url))) {
  execSync('node scripts/make-sample.mjs', { stdio: 'inherit' });
}

const failures = [];
const assert = (cond, msg) => {
  if (!cond) {
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
};
const step = async (name, fn) => {
  process.stdout.write(`→ ${name}\n`);
  await fn();
};

// Abre o menu "Baixar" do header e escolhe um formato (PDF/DOCX/ODT/JPG/PDF/A).
const downloadAs = async (format, fileName, shot) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByRole('button', { name: /^Baixar$/ }).click();
      if (shot) await page.screenshot({ path: join(SHOTS, shot) });
      await page.getByRole('menuitem', { name: new RegExp(`^${format}$`) }).click();
    })(),
  ]);
  const path = fileURLToPath(new URL(`../e2e/${fileName}`, import.meta.url));
  await download.saveAs(path);
  return path;
};

// Lê largura/altura (chunk IHDR) de um PNG.
const pngSize = (png) => {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
};

// Abre um PDF pelo botão do header e espera a nova aba aparecer.
// O chooser do Chrome pode demorar several segundos para abrir.
const OPEN_TIMEOUT = 20000;
const openViaHeader = async (file, expectedTabs) => {
  const chooserP = page.waitForEvent('filechooser', { timeout: OPEN_TIMEOUT });
  await page.getByRole('button', { name: 'Abrir PDF' }).click();
  const chooser = await chooserP;
  await chooser.setFiles(file);
  await page.waitForFunction(
    (n) => document.querySelectorAll('.doc-tab').length === n,
    expectedTabs,
    { timeout: 15000 },
  );
  // A aba aparece ainda em "Abrindo…"; espera o rótulo final (arquivo carregado).
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.doc-tab-name')].every(
        (el) => !el.textContent.startsWith('Abrindo '),
      ),
    null,
    { timeout: 15000 },
  );
};

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  console.log('usando Chrome do sistema');
} catch {
  browser = await chromium.launch({ headless: true });
  console.log('usando Chromium do Playwright');
}

const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/favicon|standardFontDataUrl|Failed to load resource/.test(t)) return;
  errors.push(`console: ${t}`);
});

try {
  await step('abrir o app', async () => {
    await page.goto(BASE);
    await page.waitForSelector('.brand-logo');
    const logoSrc = await page.locator('.brand-logo').getAttribute('src');
    assert(
      (logoSrc ?? '').includes('icone-editor-de-pdf.png'),
      `logo do cabeçalho usa icone-editor-de-pdf.png (veio "${logoSrc}")`,
    );
    assert((await page.locator('.brand-name').count()) === 0, 'texto do nome removido do cabeçalho');
    assert((await page.title()) === 'Editor de PDF', `título da página ("${await page.title()}")`);
    await page.screenshot({ path: join(SHOTS, '01-vazio.png') });
  });

  await step('carregar sample.pdf via drop', async () => {
    await page.evaluate(async () => {
      const res = await fetch('/e2e/sample.pdf');
      const buf = await res.arrayBuffer();
      const file = new File([buf], 'sample.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    });
    await page.waitForSelector('.drag-overlay');
    await page.evaluate(async () => {
      const res = await fetch('/e2e/sample.pdf');
      const buf = await res.arrayBuffer();
      const file = new File([buf], 'sample.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      window.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
    });
    await page.waitForSelector('.page');
    await page.waitForSelector('.text-hit');
    await page.waitForSelector('.img-hit');
    assert((await page.locator('.page').count()) === 2, 'duas páginas renderizadas');
    assert((await page.locator('.img-hit').count()) >= 1, 'imagem original detectada');
    await page.screenshot({ path: join(SHOTS, '02-carregado.png') });
  });

  await step('editar texto existente', async () => {
    await page.locator('[data-page="0"] .text-hit').first().click();
    await page.waitForSelector('.draft-editor');
    await page.fill('.draft-editor', 'Texto editado com sucesso');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.el-text');
    const texts = await page.locator('[data-page="0"] .el-text').allTextContents();
    assert(texts.some((t) => t.includes('Texto editado com sucesso')), 'texto editado aplicado');
  });

  await step('adicionar novo texto', async () => {
    await page.getByTitle('Adicionar texto (T)').click();
    const box = await page.locator('[data-page="0"]').boundingBox();
    await page.mouse.click(box.x + 120, box.y + 550);
    await page.waitForSelector('.inline-editor');
    await page.fill('.inline-editor', 'Novo texto adicionado');
    await page.keyboard.press('Enter');
    const texts = await page.locator('[data-page="0"] .el-text').allTextContents();
    assert(texts.some((t) => t.includes('Novo texto adicionado')), 'novo texto adicionado');
  });

  await step('desenhar retângulo', async () => {
    await page.getByTitle('Desenhar retângulo (R)').click();
    const box = await page.locator('[data-page="0"]').boundingBox();
    await page.mouse.move(box.x + 200, box.y + 600);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + 680, { steps: 5 });
    await page.mouse.up();
    assert((await page.locator('[data-page="0"] .el-rect').count()) === 1, 'retângulo criado');
  });

  await step('apagar parágrafo com borracha', async () => {
    await page.getByTitle('Apagar conteúdo (E)').click();
    const box = await page.locator('[data-page="0"]').boundingBox();
    await page.mouse.move(box.x + 50, box.y + 370);
    await page.mouse.down();
    await page.mouse.move(box.x + 340, box.y + 398, { steps: 6 });
    await page.mouse.up();
    assert((await page.locator('[data-page="0"] .el-erase').count()) === 1, 'área apagada criada');
  });

  await step('undo/redo', async () => {
    await page.getByTitle('Selecionar e mover (V)').click();
    const before = await page.locator('.el').count();
    await page.keyboard.press('Control+z');
    assert((await page.locator('.el').count()) === before - 1, 'undo remove último elemento');
    await page.keyboard.press('Control+Shift+z');
    assert((await page.locator('.el').count()) === before, 'redo re-insere elemento');
  });

  await step('clicar imagem original → materializar, mover, duplicar, excluir', async () => {
    await page.getByTitle('Selecionar e mover (V)').click();
    const hit = page.locator('[data-page="0"] .img-hit').first();
    await hit.click();
    await page.waitForSelector('.el-image.selected');
    assert((await page.locator('[data-page="0"] .el-image').count()) === 1, 'imagem materializada');
    assert((await page.locator('[data-page="0"] .el-erase').count()) === 2, 'erase por baixo da imagem');
    await page.screenshot({ path: join(SHOTS, '03-imagem-selecionada.png') });

    const el = page.locator('.el-image.selected');
    const before = await el.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 80, before.y + before.height / 2 + 60, {
      steps: 6,
    });
    await page.mouse.up();
    const after = await el.boundingBox();
    assert(
      Math.abs(after.x - (before.x + 80)) < 4 && Math.abs(after.y - (before.y + 60)) < 4,
      'imagem movida com o mouse',
    );

    await page.keyboard.press('Control+d');
    assert((await page.locator('[data-page="0"] .el-image').count()) === 2, 'Ctrl+D duplica imagem');
    await page.keyboard.press('Delete');
    assert((await page.locator('[data-page="0"] .el-image').count()) === 1, 'Delete remove duplicata');
  });

  await step('inserir imagem nova pela ferramenta', async () => {
    await page.getByTitle('Inserir imagem (I)').click();
    const box = await page.locator('[data-page="0"]').boundingBox();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.mouse.click(box.x + 300, box.y + 560),
    ]);
    await chooser.setFiles('public/e2e/test-image.png');
    await page.waitForSelector('.el-image.selected');
    assert((await page.locator('[data-page="0"] .el-image').count()) === 2, 'imagem inserida');
    await page.getByTitle('Selecionar e mover (V)').click();
    await page.screenshot({ path: join(SHOTS, '04-edicoes.png') });
  });

  let downloadedPath = '';
  await step('baixar PDF editado', async () => {
    downloadedPath = await downloadAs('PDF', 'downloaded.pdf');
    assert(existsSync(downloadedPath), 'arquivo baixado existe');
  });

  await step('verificar conteúdo do PDF exportado', async () => {
    const data = new Uint8Array(readFileSync(downloadedPath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const p1 = await doc.getPage(1);
    const content = (await p1.getTextContent()).items.map((i) => i.str).join(' ');
    assert(content.includes('Texto editado com sucesso'), 'export contém texto editado');
    assert(content.includes('Novo texto adicionado'), 'export contém novo texto');
    assert(content.includes('Texto original de teste 123'), 'stream original ainda existe (coberto)');
    const ops = await p1.getOperatorList();
    const paints = ops.fnArray.filter((f) => f === pdfjs.OPS.paintImageXObject).length;
    assert(paints >= 2, `export contém imagens (paints=${paints})`);
    assertBrandMeta((await doc.getMetadata()).info, 'export');
  });

  await step('reabrir PDF exportado no app', async () => {
    await openViaHeader(downloadedPath, 2);
    await page.waitForSelector('.text-hit');
    await page.screenshot({ path: join(SHOTS, '05-export-reaberto.png') });
    assert((await page.locator('.doc-tab').count()) === 2, '2ª aba criada ao reabrir export');
  });

  await step('página 2 imagem', async () => {
    const p2 = page.locator('[data-page="1"]');
    await p2.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.querySelector('[data-page="1"]')?.querySelectorAll('.img-hit').length >= 1,
      null,
      { timeout: 8000 },
    );
    const count = await page.locator('[data-page="1"] .img-hit').count();
    assert(count >= 1, 'imagem original da página 2 detectada');
    await page.screenshot({ path: join(SHOTS, '06-pagina2.png') });
  });
  await step('abrir 3º documento e respeitar limite de abas', async () => {
    // 2 abas já abertas (sample + export reaberto)
    await openViaHeader('public/e2e/sample-b.pdf', 3);
    assert((await page.locator('.doc-tab').count()) === 3, 'três abas abertas');
    assert(
      (await page.locator('.doc-tab').nth(2).textContent())?.includes('sample-b.pdf'),
      '3ª aba mostra o nome do arquivo',
    );
    await page.screenshot({ path: join(SHOTS, '07-tres-abas.png') });

    // 4º documento: o store recusa e exibe aviso; o botão segue clicável
    await page.getByRole('button', { name: 'Abrir PDF' }).click();
    await page.waitForSelector('.toast', { timeout: 15000 });
    const toast = (await page.locator('.toast').last().textContent()) ?? '';
    assert(/até 3/.test(toast), `aviso de limite exibido (toast: "${toast.trim()}")`);
    assert((await page.locator('.doc-tab').count()) === 3, '4º documento não abre (limite)');
    await page.screenshot({ path: join(SHOTS, '08-limite-abas.png') });
    await page.waitForTimeout(300);
  });

  await step('alternar abas: borda ativa vermelha, demais cinza', async () => {
    const tab0 = page.locator('.doc-tab').nth(0);
    await tab0.click();
    await page.waitForTimeout(200);
    const border0 = await page.locator('.doc-tab').nth(0).evaluate((el) => getComputedStyle(el).borderColor);
    const border1 = await page.locator('.doc-tab').nth(1).evaluate((el) => getComputedStyle(el).borderColor);
    assert(border0 !== border1, 'aba ativa tem borda diferente das inativas');
    await page.screenshot({ path: join(SHOTS, '08-aba-ativa.png') });
  });

  await step('download reflete o documento ativo', async () => {
    // ativa a 3ª aba (sample limpo, sem edições) e insere um texto marcador
    await page.locator('.doc-tab').nth(2).click();
    await page.waitForTimeout(250);
    await page.getByTitle('Adicionar texto (T)').click();
    const box = await page.locator('[data-page="0"]').boundingBox();
    await page.mouse.click(box.x + 120, box.y + 620);
    await page.waitForSelector('.inline-editor');
    await page.fill('.inline-editor', 'MARCADOR_DOC_ATIVO');
    await page.keyboard.press('Enter');
    await page.getByTitle('Selecionar e mover (V)').click();

    const activePath = await downloadAs('PDF', 'downloaded-ativo.pdf');

    const data = new Uint8Array(readFileSync(activePath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const p1 = await doc.getPage(1);
    const content = (await p1.getTextContent()).items.map((i) => i.str).join(' ');
    assert(content.includes('MARCADOR_DOC_ATIVO'), 'download contém texto do doc ativo');
    assert(!content.includes('Texto editado com sucesso'), 'download NÃO contém edições de outro doc');
  });

  await step('fechar aba com edições pede confirmação', async () => {
    // aba 0 tem edições; seu × deve abrir o modal
    await page.locator('.doc-tab').nth(0).locator('.doc-tab-close').click();
    await page.waitForSelector('.modal-card');
    assert(true, 'modal de confirmação exibido para doc com edições');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(150);
    assert((await page.locator('.doc-tab').count()) === 3, 'cancelar mantém a aba');

    // fecha sem confirmação usando uma aba sem edições? a aba 2 tem 1 texto.
    // fecha a aba 1 (export reaberto, sem edições) → direto
    await page.locator('.doc-tab').nth(1).locator('.doc-tab-close').click();
    await page.waitForTimeout(250);
    assert((await page.locator('.doc-tab').count()) === 2, 'aba sem edições fecha direto');
  });

  await step('confirmar fechamento descarta a aba', async () => {
    await page.locator('.doc-tab').nth(1).locator('.doc-tab-close').click();
    await page.waitForSelector('.modal-card');
    await page.getByRole('button', { name: /descartar/i }).click();
    await page.waitForTimeout(250);
    assert((await page.locator('.doc-tab').count()) === 1, 'aba fechada após confirmar');
  });

  await step('dividir PDF em duas partes', async () => {
    // 1 aba restante (sample com edições, 2 páginas)
    await page.getByRole('button', { name: 'Dividir', exact: true }).click();
    await page.waitForSelector('.modal-split');
    const hint = (await page.locator('.split-hint').textContent()) ?? '';
    assert(/2 páginas disponíveis/.test(hint), `sugestão mostra páginas disponíveis ("${hint.trim()}")`);
    const value = await page.locator('.split-input').inputValue();
    assert(value === '1-1\n2-2', `sugestão divide ao meio (value="${value}")`);

    // intervalo inválido exibe erro inline e não baixa nada
    await page.locator('.split-input').fill('1-9');
    await page.getByRole('button', { name: /Dividir e baixar/ }).click();
    await page.waitForSelector('.split-error');
    const err = (await page.locator('.split-error').textContent()) ?? '';
    assert(/entre 1 e 2/.test(err), `erro de limite exibido ("${err.trim()}")`);

    await page.locator('.split-input').fill('1-1\n2-2');
    await page.waitForSelector('.split-hint');
    await page.screenshot({ path: join(SHOTS, '09-split-dialogo.png') });

    const waitForDownload = async (name) => {
      const d = await page.waitForEvent('download');
      const p = fileURLToPath(new URL(`../e2e/${name}`, import.meta.url));
      await d.saveAs(p);
      return p;
    };
    const downloads = Promise.all([
      waitForDownload('split-parte-1.pdf'),
      waitForDownload('split-parte-2.pdf'),
    ]);
    await page.getByRole('button', { name: /Dividir e baixar/ }).click();
    const [part1, part2] = await downloads;
    assert(existsSync(part1) && existsSync(part2), 'duas partes baixadas');

    const doc1 = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(part1)) }).promise;
    assert(doc1.numPages === 1, `parte 1 tem 1 página (tem ${doc1.numPages})`);
    const c1 = (await (await doc1.getPage(1)).getTextContent()).items.map((i) => i.str).join(' ');
    assert(c1.includes('Texto editado com sucesso'), 'parte 1 contém edição da página 1');
    assertBrandMeta((await doc1.getMetadata()).info, 'split parte 1');

    const doc2 = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(part2)) }).promise;
    assert(doc2.numPages === 1, `parte 2 tem 1 página (tem ${doc2.numPages})`);

    await page.waitForSelector('.toast');
    const toast = (await page.locator('.toast').textContent()) ?? '';
    assert(/2 arquivos gerados/.test(toast), `aviso de sucesso ("${toast.trim()}")`);
    assert(!(await page.locator('.modal-split').isVisible()), 'diálogo fechou após dividir');
    await page.screenshot({ path: join(SHOTS, '10-split-pronto.png') });
  });

  await step('baixar DOCX com fidelidade das páginas', async () => {
    const path = await downloadAs('DOCX', 'downloaded.docx', '11-menu-formato.png');
    await page.waitForFunction(
      () => [...document.querySelectorAll('.toast')].some((el) => /DOCX gerado/.test(el.textContent ?? '')),
      null,
      { timeout: 5000 },
    );
    const raw = new Uint8Array(readFileSync(path));
    assert(raw[0] === 0x50 && raw[1] === 0x4b, 'docx começa com assinatura ZIP');
    const files = unzipSync(raw);
    assert('word/document.xml' in files, 'docx contém word/document.xml');
    const xml = new TextDecoder().decode(files['word/document.xml']);
    assert(xml.includes('<wp:inline'), 'docx: imagem inline ocupando a página');
    assert((xml.match(/w:br w:type="page"/g) ?? []).length >= 1, 'docx tem quebra de página');
    assert(xml.includes('w:framePr'), 'docx: textos em molduras posicionadas (editáveis)');
    assert(xml.includes('Texto editado com sucesso'), 'docx: texto editado é texto de verdade');
    assert(xml.includes('Novo texto adicionado'), 'docx: texto adicionado é texto de verdade');
    assert(xml.includes('Outro conteudo na pagina 1'), 'docx: texto original preservado é editável');
    assert(xml.includes('Pagina 2 - conteudo do segundo texto'), 'docx: texto da página 2');
    assert(!xml.includes('Texto original de teste 123'), 'docx: texto coberto não vaza');
    assert(!xml.includes('Este paragrafo sera apagado'), 'docx: parágrafo apagado não vaza');
    const rels = new TextDecoder().decode(files['word/_rels/document.xml.rels']);
    assert(rels.includes('media/page1.png'), 'docx: relationship da imagem da página 1');
    const media = Object.keys(files).filter((n) => /^word\/media\/page\d+\.png$/.test(n));
    assert(media.length === 2, `docx embute as 2 páginas como PNG (veio ${media.length})`);
    const png = files['word/media/page1.png'];
    assert(png[0] === 0x89 && png[1] === 0x50, 'png da página 1 válido');
    const { w, h } = pngSize(png);
    assert(w > 1000 && Math.abs(w / h - 612 / 792) < 0.02, `png na proporção da página (${w}×${h})`);
    const core = new TextDecoder().decode(files['docProps/core.xml']);
    assert(core.includes(`<dc:creator>${BRAND}</dc:creator>`), 'docx: dc:creator é a marca');
    assert(core.includes(`<dc:subject>${BRAND}</dc:subject>`), 'docx: dc:subject é a marca');
    const app = new TextDecoder().decode(files['docProps/app.xml']);
    assert(app.includes(`<Application>${BRAND}</Application>`), 'docx: Application é a marca');
    writeFileSync(fileURLToPath(new URL('../e2e/shots/docx-pagina1.png', import.meta.url)), png);
  });

  await step('baixar ODT com fidelidade das páginas', async () => {
    const path = await downloadAs('ODT', 'downloaded.odt');
    const raw = new Uint8Array(readFileSync(path));
    assert(raw[0] === 0x50 && raw[1] === 0x4b, 'odt começa com assinatura ZIP');
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const nameLen = dv.getUint16(26, true);
    const firstName = new TextDecoder().decode(raw.slice(30, 30 + nameLen));
    assert(firstName === 'mimetype', `odt tem mimetype como 1º item (veio "${firstName}")`);
    assert(dv.getUint16(8, true) === 0, 'odt: mimetype armazenado sem compressão');
    const files = unzipSync(raw);
    assert(
      new TextDecoder().decode(files.mimetype).trim() === 'application/vnd.oasis.opendocument.text',
      'odt: mimetype correto',
    );
    const xml = new TextDecoder().decode(files['content.xml']);
    assert(xml.includes('<draw:image'), 'odt: imagem da página');
    assert(xml.includes('xlink:href="Pictures/page1.png"'), 'odt: referencia a Pictures/page1.png');
    assert(xml.includes('fo:break-before="page"'), 'odt tem estilo de quebra de página');
    assert(xml.includes('fo:margin-top='), 'odt: textos posicionados por margem (editáveis)');
    assert(xml.includes('Texto editado com sucesso'), 'odt: texto editado é texto de verdade');
    assert(xml.includes('Novo texto adicionado'), 'odt: texto adicionado é texto de verdade');
    assert(xml.includes('Outro conteudo na pagina 1'), 'odt: texto original preservado é editável');
    assert(xml.includes('Pagina 2 - conteudo do segundo texto'), 'odt: texto da página 2');
    assert(!xml.includes('Texto original de teste 123'), 'odt: texto coberto não vaza');
    assert(!xml.includes('Este paragrafo sera apagado'), 'odt: parágrafo apagado não vaza');
    const manifest = new TextDecoder().decode(files['META-INF/manifest.xml']);
    assert(manifest.includes('Pictures/page1.png'), 'odt: manifest registra a imagem');
    const pictures = Object.keys(files).filter((n) => /^Pictures\/page\d+\.png$/.test(n));
    assert(pictures.length === 2, `odt embute as 2 páginas como PNG (veio ${pictures.length})`);
    const { w, h } = pngSize(files['Pictures/page1.png']);
    assert(w > 1000 && Math.abs(w / h - 612 / 792) < 0.02, `png na proporção da página (${w}×${h})`);
    const meta = new TextDecoder().decode(files['meta.xml']);
    assert(meta.includes(`<dc:creator>${BRAND}</dc:creator>`), 'odt: dc:creator é a marca');
    assert(meta.includes(`<dc:subject>${BRAND}</dc:subject>`), 'odt: dc:subject é a marca');
    assert(meta.includes(`<meta:generator>${BRAND}</meta:generator>`), 'odt: meta:generator é a marca');
  });

  await step('baixar JPG (uma imagem por página)', async () => {
    const got = [];
    const onDl = (d) => got.push(d);
    page.on('download', onDl);
    await page.getByRole('button', { name: /^Baixar$/ }).click();
    await page.getByRole('menuitem', { name: /^JPG$/ }).click();
    await page.waitForFunction(
      () => [...document.querySelectorAll('.toast')].some((el) => /JPG gerado/.test(el.textContent ?? '')),
      null,
      { timeout: 8000 },
    );
    await page.waitForTimeout(700); // downloads espaçados de 300 ms
    page.off('download', onDl);
    assert(got.length === 2, `jpg: 2 downloads (veio ${got.length})`);
    const p1 = fileURLToPath(new URL('../e2e/downloaded-pagina-1.jpg', import.meta.url));
    await got[0].saveAs(p1);
    const jpg = new Uint8Array(readFileSync(p1));
    assert(jpg[0] === 0xff && jpg[1] === 0xd8 && jpg[2] === 0xff, 'jpg: assinatura JPEG');
    assert(jpg.length > 10000, `jpg: conteúdo real (${jpg.length} bytes)`);
    const p2 = fileURLToPath(new URL('../e2e/downloaded-pagina-2.jpg', import.meta.url));
    await got[1].saveAs(p2);
    const jpg2 = new Uint8Array(readFileSync(p2));
    assert(jpg2[0] === 0xff && jpg2[1] === 0xd8, 'jpg: página 2 também é JPEG');
  });

  await step('baixar PDF/A com identificação XMP pdfaid', async () => {
    const path = await downloadAs('PDF/A', 'downloaded-pdfa.pdf');
    await page.waitForFunction(
      () => [...document.querySelectorAll('.toast')].some((el) => /PDF\/A gerado/.test(el.textContent ?? '')),
      null,
      { timeout: 5000 },
    );
    const raw = new Uint8Array(readFileSync(path));
    const all = new TextDecoder('latin1').decode(raw);
    assert(all.startsWith('%PDF-'), 'pdfa: começa com %PDF');
    assert(raw[0] === 0x25 && raw[1] === 0x50, 'pdfa: assinatura %P');
    assert(all.includes('<pdfaid:part>3</pdfaid:part>'), 'pdfa: XMP identifica parte 3');
    assert(all.includes('<pdfaid:conformance>B</pdfaid:conformance>'), 'pdfa: conformidade B');
    assert(all.includes('/Metadata'), 'pdfa: catálogo referencia /Metadata');
    const metaDoc = await pdfjs.getDocument({ data: raw }).promise;
    assertBrandMeta((await metaDoc.getMetadata()).info, 'pdfa');
  });

  await step('rodapé: marca, Ajuda e troca de idioma', async () => {
    assert(await page.locator('.app-footer').isVisible(), 'rodapé visível');
    const brand = (await page.locator('.app-footer-brand').textContent()) ?? '';
    assert(
      brand.includes('Seu Editor de Arquivos PDF ®'),
      `marca do rodapé ("${brand.trim()}")`,
    );
    const help = page.getByRole('button', { name: /^Ajuda$/ });
    assert((await help.count()) === 1, 'botão Ajuda presente');
    assert(!(await help.isDisabled()), 'botão Ajuda ativo');
    assert(
      (await page.locator('.header select').count()) === 0,
      'seletor de idioma removido do cabeçalho',
    );

    // Ícone do cabeçalho é um link para a página principal
    const iconHref = await page.locator('.brand a').getAttribute('href');
    assert(iconHref === '/', `ícone é link para a página principal (href="${iconHref}")`);

    // Área Ajuda: título, espaçamentos, caixa "Informações" e negrito
    await help.click();
    await page.waitForSelector('.help-view');
    const helpTitle = (await page.locator('.help-title').textContent()) ?? '';
    assert(helpTitle.includes('Ajuda e Informações'), `título da área Ajuda ("${helpTitle.trim()}")`);
    const innerW = await page
      .locator('.help-inner')
      .evaluate((el) => el.getBoundingClientRect().width);
    const viewW = await page
      .locator('.help-view')
      .evaluate((el) => el.getBoundingClientRect().width);
    assert(
      innerW <= viewW * 0.6 + 2,
      `conteúdo ocupa até 60% da largura (${Math.round(innerW)}/${Math.round(viewW)})`,
    );
    const cardTitle = page.locator('.help-card').nth(0).locator('.help-card-title');
    assert((await cardTitle.textContent()) === 'Informações', 'caixa com título "Informações"');
    const titleBg = await cardTitle.evaluate((el) => getComputedStyle(el).backgroundColor);
    assert(titleBg === 'rgb(255, 64, 48)', `fundo do título #ff4030 (veio ${titleBg})`);
    const titleColor = await cardTitle.evaluate((el) => getComputedStyle(el).color);
    assert(titleColor === 'rgb(255, 255, 255)', `texto do título branco (veio ${titleColor})`);
    const cardStyle = await page.locator('.help-card').nth(0).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        border: s.borderTopStyle,
        borderWidth: s.borderTopWidth,
        borderColor: s.borderTopColor,
        radius: parseFloat(s.borderTopLeftRadius),
        bg: s.backgroundColor,
      };
    });
    assert(cardStyle.border === 'dashed', `borda da caixa tracejada (veio ${cardStyle.border})`);
    assert(cardStyle.borderWidth === '2px', `borda 2px (veio ${cardStyle.borderWidth})`);
    assert(
      cardStyle.borderColor === 'rgb(201, 209, 219)',
      `borda 2px tracejada #c9d1db (veio ${cardStyle.borderColor})`,
    );
    assert(cardStyle.radius > 0, 'bordas arredondadas');
    assert(cardStyle.bg === 'rgb(255, 255, 255)', 'fundo da caixa branco');
    const bodyStyle = await page.locator('.help-card-body').nth(0).evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, bg: s.backgroundColor };
    });
    assert(bodyStyle.color === 'rgb(0, 0, 0)', `texto do conteúdo preto (veio ${bodyStyle.color})`);
    assert(bodyStyle.bg === 'rgb(255, 255, 255)', `fundo do conteúdo branco (veio ${bodyStyle.bg})`);
    const card1 = page.locator('.help-card').nth(0);
    const card2 = page.locator('.help-card').nth(1);
    assert((await page.locator('.help-card').count()) === 2, 'área Ajuda com 2 caixas');
    const titleAlign = await cardTitle.evaluate((el) => getComputedStyle(el).textAlign);
    assert(titleAlign === 'center', `título da caixa centralizado (veio ${titleAlign})`);
    const bolds = await card1.locator('.help-card-body strong').allTextContents();
    assert(
      bolds.length === 3 &&
        bolds[0] === 'Editor de Arquivos PDF' &&
        bolds[1] === 'inteligência artificial' &&
        bolds[2] === 'Editor de Arquivos PDF',
      `negritos do conteúdo (${bolds.join(' | ')})`,
    );
    assert(
      (await card1.locator('.help-card-body p').count()) === 3,
      'primeira caixa com 3 parágrafos',
    );

    // Caixa "Ajuda" abaixo da primeira, título centralizado e negrito
    const AjudaTitle = card2.locator('.help-card-title');
    assert((await AjudaTitle.textContent()) === 'Ajuda', '2ª caixa com título "Ajuda"');
    const AjudaAlign = await AjudaTitle.evaluate((el) => getComputedStyle(el).textAlign);
    assert(AjudaAlign === 'center', `título "Ajuda" centralizado (veio ${AjudaAlign})`);
    const AjudaText = (await card2.locator('.help-card-body').textContent()) ?? '';
    assert(
      AjudaText.includes('Assista o vídeo abaixo, para conhecer as principais funcionalidades do '),
      'texto da caixa "Ajuda"',
    );
    const AjudaBold = card2.locator('.help-card-body strong');
    assert(
      (await AjudaBold.count()) === 1 && (await AjudaBold.textContent()) === 'Editor de Arquivos PDF',
      "'Editor de Arquivos PDF' em negrito na caixa Ajuda",
    );

    // Vídeo do YouTube abaixo do texto da caixa "Ajuda": 1080p e legendas desativadas
    const helpVideo = card2.locator('.help-video iframe');
    assert((await helpVideo.count()) === 1, 'vídeo do YouTube presente na caixa "Ajuda"');
    const videoSrc = (await helpVideo.getAttribute('src')) ?? '';
    assert(
      videoSrc.includes('youtube.com/embed/9JdHEaMH6Bo'),
      `vídeo 9JdHEaMH6Bo embedado (veio "${videoSrc}")`,
    );
    assert(videoSrc.includes('vq=hd1080'), `vídeo solicitado em 1080p (veio "${videoSrc}")`);
    assert(
      videoSrc.includes('cc_load_policy=0'),
      `vídeo com legendas desativadas (veio "${videoSrc}")`,
    );
    const videoTitle = (await helpVideo.getAttribute('title')) ?? '';
    assert(videoTitle.includes('YouTube'), `título do iframe do vídeo (veio "${videoTitle}")`);
    const AjudaP = card2.locator('.help-card-body p');
    const videoBox = await helpVideo.boundingBox();
    const AjudaPBox = await AjudaP.boundingBox();
    assert(
      videoBox.y >= AjudaPBox.y + AjudaPBox.height,
      'vídeo abaixo do texto da caixa "Ajuda"',
    );
    assert(videoBox.height > 0, 'vídeo com altura visível (> 0)');
    const card2Box = await card2.boundingBox();
    const card1Box = await card1.boundingBox();
    assert(card2Box.y >= card1Box.y + card1Box.height, 'caixa "Ajuda" abaixo da primeira');
    const blank = page.locator('.help-blank');
    assert((await blank.count()) === 1, 'linha em branco após a caixa "Ajuda"');
    const blankBox = await blank.boundingBox();
    assert(blankBox.height > 0, 'linha em branco visível (altura > 0)');
    assert(
      blankBox.y >= card2Box.y + card2Box.height,
      'linha em branco vem depois da caixa "Ajuda"',
    );
    await page.screenshot({ path: join(SHOTS, '13-ajuda.png') });

    // Botão Ajuda alterna: fecha a área e volta ao editor
    await help.click();
    await page.waitForSelector('.help-view', { state: 'detached' });

    const langBtn = page.getByRole('button', { name: /^Português$/ });
    assert((await langBtn.count()) === 1, 'botão de idioma com ícone e texto do idioma atual');
    await langBtn.click();
    await page.waitForSelector('.lang-menu');
    const btnBox = await langBtn.boundingBox();
    const menuBox = await page.locator('.lang-menu').boundingBox();
    assert(
      menuBox.y + menuBox.height <= btnBox.y + 1,
      'menu de idioma abre acima do botão',
    );
    const radios = page.getByRole('menuitemradio');
    assert((await radios.count()) === 4, 'menu de idioma com 4 opções');
    const labels = (await radios.allTextContents()).map((s) => s.trim());
    assert(
      JSON.stringify(labels) === JSON.stringify(['Português', 'Inglês', 'Francês', 'Espanhol']),
      `nomes dos idiomas (${labels.join(' | ')})`,
    );
    await page.getByRole('menuitemradio', { name: 'Inglês' }).click();
    await page.waitForFunction(
      () => document.querySelector('.app-footer-brand')?.textContent?.includes('Your PDF File Editor ®'),
      null,
      { timeout: 5000 },
    );
    assert((await page.getByRole('button', { name: /^Help$/ }).count()) === 1, 'rodapé em inglês');
    assert(
      (await page.getByRole('button', { name: /^Inglês$/ }).count()) === 1,
      'botão de idioma mostra o idioma atual (Inglês)',
    );
    await page.screenshot({ path: join(SHOTS, '12-rodape-english.png') });

    // Volta para pt-BR: os demais seletores do E2E assumem o idioma padrão.
    await page.getByRole('button', { name: /^Inglês$/ }).click();
    await page.getByRole('menuitemradio', { name: 'Português' }).click();
    await page.waitForFunction(
      () => document.querySelector('.app-footer-brand')?.textContent?.includes('Seu Editor de Arquivos PDF ®'),
      null,
      { timeout: 5000 },
    );
    assert((await page.getByRole('button', { name: /^Ajuda$/ }).count()) === 1, 'rodapé volta a pt-BR');
  });
} catch (err) {
  failures.push(`exceção: ${err.message}`);
  console.error(err);
  await page
    .screenshot({ path: join(SHOTS, '99-erro.png') })
    .catch(() => {});
} finally {
  await browser.close();
}

if (errors.length) {
  console.log('\nerros de console/página:');
  for (const e of errors) console.log(' -', e);
}
for (const e of errors) failures.push(e);

if (failures.length) {
  console.error(`\n✗ E2E falhou: ${failures.length} problema(s)`);
  process.exit(1);
}
console.log('\n✓ E2E completo: todas as verificações passaram');
