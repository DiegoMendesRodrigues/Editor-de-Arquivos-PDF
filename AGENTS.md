# AGENTS.md

## O que é

Editor de PDF no navegador: React 19 + TypeScript + Vite 8. Interface multi-idioma (pt-BR padrão; en, fr, es).
Usuário carrega até 3 PDFs em abas, edita textos/imagens/conteúdo no local, exclui páginas, junta documentos, divide em vários PDFs e baixa o resultado em **PDF, DOCX, ODT, JPG ou PDF/A**.

Bibliotecas, papéis distintos (não trocar):
- **pdfjs-dist** (v6): renderizar páginas, extrair texto e regiões de imagem (leitura).
- **pdf-lib**: gerar/exportar/mesclar/dividir o PDF final (escrita).
- **fflate**: só para zipar os DOCX/ODT gerados à mão (não serve de "biblioteca de documentos").

## Comandos

```bash
npm install            # roda postinstall (copia assets do pdf.js p/ public/)
npm run dev            # Vite em http://127.0.0.1:5173 (strictPort, host 127.0.0.1)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run build          # tsc --noEmit && vite build
node scripts/e2e.mjs   # E2E Playwright (requer dev server rodando)
node scripts/geom-check.mjs      # confere geometria de texto (baseline/width) via pdf.js
node scripts/regions-check.mjs   # confere regiões de imagem extraídas via pdf.js
```

Ordem de verificação antes de entregar: `typecheck` → `lint` → `build`. E2E só depois de `dev` ativo. Os dois checks de geometria/regiões são standalone (geram um PDF de teste) — rodar ao tocar em `pdfSource.ts`, `geometry.ts` ou `textMetrics.ts`.

## Arquitetura

- `src/state/editorStore.ts` — store Zustand, fonte da verdade. `docs: DocState[]` (máx. 3), doc ativo via `activeDoc(s)`. Histórico por doc: `past`/`future` de `DocSnapshot { elements, deletedPages }`. `locale` também vive aqui (ver i18n).
- `src/lib/pdfSource.ts` — pdf.js: `openPdf`, `readPageInfo`, `extractTextItems`, `extractImageRegions`.
- `src/lib/pdfExport.ts` — pdf-lib: `buildPdf` (elementos + remoção de páginas), `buildPdfA` (buildPdf + XMP `pdfaid:part=3`/`conformance=B`, melhor esforço — Helvetica base14 não embutida), `mergePdfs`, `splitPdf` (extrai intervalos de um PDF já montado).
- `src/lib/renderExport.ts` — pdf.js: `renderPageImages(bytes, opts?)` → `ExportPage { bytes, widthPt, heightPt, texts }` (página inteira, escala 2; PNG padrão, JPEG via `{ type:'jpeg', quality }` para o download .jpg). Fundo do DOCX/ODT híbrido.
- `src/lib/textExport.ts` — `extractExportTexts(doc, elements, deletedPages)`: texto original (itens não cobertos por `erase`/`text.cover` ≥ 50%, unidos por linha visual) + textos do usuário como `TextRun` posicionado; `holes` = retângulos a apagar do PNG.
- `src/lib/officeExport.ts` — `buildDocx` (OOXML) e `buildOdt` (ODF) escritos à mão e zipados com fflate, a partir de `ExportPage[]`: imagem da página (fidelidade) + textos editáveis por cima. DOCX: imagem `wp:inline` + texto em `w:framePr` (twips, âncora página). ODT: imagem `draw:frame` âncora-página + texto em parágrafos com `fo:margin-top/left` (o Word não importa `draw:frame` de texto do ODF). Juntar/dividir seguem só PDF.
- `src/lib/i18n.ts` + `src/lib/useT.ts` — tradução. Dicionários `pt-BR`/`en`/`fr`/`es`; o pt-BR (`as const`) define as chaves (`MessageKey`). Componentes usam `const t = useT()`; o store usa `translate(get().locale, ...)`. **Todo texto visível de UI passa por `t()`** — chave nova precisa entrar nos 4 dicionários. Locale persiste em `localStorage` (`editor-pdf-locale`) e sincroniza `document.documentElement.lang`.
- `src/components/Viewer.tsx` — renderiza só páginas visíveis via `visiblePages(d)` do store (filtra `deletedPages`).
- `src/components/PageStage.tsx` — uma página: canvas, camada de texto, hits de imagem, drafts.

## Quirks (fáceis de errar)

- **Cabeçalho obrigatório**: todo arquivo de código (`.ts`/`.tsx`/`.js`/`.mjs`/`.css`) começa com o comentário exato da especificação (`/* Sistema criado por Diego Mendes Rodrigues, ... artificial */` — 3 espaços entre "inteligência" e "artificial"). Não remover nem reformular; novos arquivos devem incluí-lo. Não se aplica a `.html`/`.json` nem a `node_modules`/`dist`.
- **pdf.js v6**: `page.render({ canvas, viewport })` (sem `canvasContext`). `PDFDocumentProxy.destroy` não existe. Worker: `public/pdf.worker.js` (cópia do `pdf.worker.mjs`, referenciada via `${BASE}pdf.worker.js` — extensão `.mjs` recebe `text/plain` no Hostinger/hcdn e quebra o module worker).
- **Geometria**: `TextItem.width` é em unidade usuário; baseline = `tx[5]` do `Util.transform`. Validação em `scripts/geom-check.mjs` e `regions-check.mjs`.
- **Páginas deletadas**: `DocState.deletedPages` guarda índices **originais**. Elementos também referenciam índice original. `buildPdf` remove as páginas e remapeia índices no export — não "renumerar" no store.
- **Elementos em página deletada**: ignorados no export (`if (gone.has(el.page)) continue`), mas presentes até o usuário excluir (o `confirmDeletePage` remove).
- **Divisão (split)**: `splitAndDownload` primeiro gera o PDF inteiro com `buildPdf` (edições + remoções aplicadas) e só depois `splitPdf` copia os intervalos. Os intervalos do diálogo são numerados nas páginas **visíveis** (sem as excluídas).
- **Downloads múltiplos**: o navegador pode bloquear; o store espaça 300 ms entre downloads (divisão em N partes e export **JPG**, uma JPEG por página).
- **Download com formato**: `exportAndDownload('pdf'|'docx'|'odt'|'jpg'|'pdfa')` no store; menu do botão "Baixar" (`download-group`/`download-menu`, `role=menu`/`menuitem`) itera `EXPORT_FORMATS` com `formatLabel` (PDF/A mantém a barra). Juntar/dividir continuam só PDF. **JPG** = `buildPdf` → `renderPageImages(..., { type:'jpeg', quality:0.92 })` → 1 download por página. **PDF/A** = `buildPdfA` (XMP pdfaid) — melhor esforço, não passa de veraPDF por falta de fontes embutidas. DOCX/ODT são **híbridos**: `extractExportTexts` → `buildPdf` com furos brancos (texto original) e textos do usuário reduzidos ao cover → `renderPageImages` (fundo fiel) → `buildDocx`/`buildOdt` reinsere tudo como **texto editável**.
- **Rodapé e área Ajuda**: rodapé fixo em `src/components/Footer.tsx` — marca à esquerda; à direita botão Ajuda (alterna a área Ajuda — `helpOpen`/`toggleHelp` no store; conteúdo em `HelpView.tsx` a 60% da largura: título 'Ajuda e Informações' + 2 caixas ('Informações' e 'Ajuda' — o título da 2ª reusa `t('help')`), faixa #ff4030 e borda 2px tracejada #c9d1db nos títulos das caixas, linha em branco final `.help-blank` com texto = espaço literal `helpBlankLine`) e botão globo retangular com o idioma atual que abre o menu de 4 idiomas **acima** do botão (o seletor de idioma saiu do cabeçalho).
- **Linha em branco da área Ajuda**: `.help-blank` precisa de `white-space: pre-wrap` — com `pre-line` o espaço colapsa e a linha sai com altura 0 (o E2E checa altura > 0).
- **Vídeo da área Ajuda**: a 2ª caixa embute o YouTube `9JdHEaMH6Bo` via iframe (`.help-video`, responsivo 16:9, máx. 640px, centralizado com `margin auto`) com `vq=hd1080` (pedido de 1080p — o player do YouTube decide a qualidade final pelo tamanho exibido) e `cc_load_policy=0` (legendas desativadas). Título do iframe via chave `helpVideoEmbedTitle` nos 4 dicionários.
- **Metadados de marca**: `applyBrandMeta` (`src/lib/pdfExport.ts`) define Author/Subject/Creator/Producer = `BRAND` (`src/lib/brand.ts`) em `buildPdf`/`buildPdfA`/`mergePdfs`/`splitPdf`; DOCX/ODT carregam marca em `docProps/core.xml`+`app.xml`/`meta.xml`. pdf-lib regrava Producer/Creator como "pdf-lib" em `load`/`create` — aplicar os metadados **depois**; `save({updateMetadata:false})` não existe no pdf-lib (não compila).
- **DOCX inline vs âncora**: `buildDocx` gera cada página como imagem **inline** (`wp:inline`), não flutuante. Imagens âncora (`wp:anchor`, `behindDoc="1"`) empilham todas na 1ª página no Word; inline força quebra de página real por imagem (uma página de imagem por página do PDF). Textos ficam em `w:framePr` (molduras posicionadas, fora do fluxo).
- **Word não importa draw:frame de texto do ODF**: só frames com `draw:image`. No ODT, o texto editável vai como parágrafo comum com `fo:margin-top`/`fo:margin-left` por estilo automático (`P{página}_{n}`); a imagem da página fica âncora-página (fora do fluxo) e não desloca os parágrafos. `cm()` em `officeExport.ts` precisa converter pt→cm reais (`pt*2.54/72`); o valor antigo (mm rotulado como cm) fazia o Word clamped/paginar a mais.
- **ODT (ODF estrito)**: `mimetype` precisa ser o **1º item do ZIP e sem compressão** (`zipSync` com `[bytes, { level: 0 }]` e ordem de inserção preservada) — caso contrário consumidores rejeitam o arquivo. Conferir `styles.xml`/`manifest.xml` válidos antes de fechar.
- **ESLint `react-hooks/set-state-in-effect`**: proíbe `setState` síncrono dentro de `useEffect`. Diálogos com estado inicial derivado (ex.: `SplitForm`) montam o formulário só quando o diálogo abre e inicializam via `useState(() => ...)`, sem effect.
- **Assets do pdf.js**: `postinstall` copia `standard_fonts`, `cmaps`, `wasm` e `build/pdf.worker.mjs` (como `pdf.worker.js`) de `node_modules/pdfjs-dist` para `public/`. Se faltar fonte no render, rodar `npm install` de novo.
- **Deploy (pdf.aplicativoia.online, Hostinger)**: subir o conteúdo de `dist/` na raiz do domínio; `public/` vai inteiro (inclui `e2e/`, usado em validação ao vivo). `public/.htaccess` define MIME de `.mjs`/`.wasm` no origin; o worker `.js` não depende disso. `.wasm` como `text/plain` só degrada (fallback do pdf.js), `.mjs` quebra. **Validar no navegador/Playwright abrindo um PDF e exportando** — checar só HTTP 200 não pega falha de MIME/worker (em 2026-10 o site respondia 200 e nenhum PDF abria).
- **Ícone/marca do cabeçalho**: `public/icone-editor-de-pdf.png` (fonte: `imagens/icone-editor-de-pdf.png`, logo em faixa 167×36 com "Editor de" + quadrado "Pdf"; exibido com `height: 28px; width: auto`, alt = `appName`). O ícone é um link `<a href={BASE_URL}>` para a página principal (reload limpa o estado). O texto do cabeçalho foi removido; `appName` (pt: 'Editor de PDF') só serve de alt/nome acessível. Título da página (`index.html`): 'Editor de PDF'. Favicon continua `public/editor-de-pdf.png`.
- **HMR após adicionar export novo**: se Vite servir "does not provide an export", reiniciar o dev server.

## E2E (`scripts/e2e.mjs`)

- Playwright com Chrome do sistema (`channel: 'chrome'`), fallback Chromium.
- Amostras em `public/e2e/` (geradas por `scripts/make-sample.mjs` se faltarem).
- Ignora erros de console: `favicon`, `standardFontDataUrl`, `Failed to load resource`.
- Seletores usam textos em pt-BR (idioma padrão do app); contexto novo = sem localStorage = pt-BR.
- Cobre fluxos de edição, export (PDF, DOCX, ODT, JPG e PDF/A), abas e divisão (downloads + PDFs gerados conferidos com pdf.js). **Junção NÃO tem cobertura E2E** (`MergeDialog`/`mergeAndDownload` são validados manualmente).
- Downloads passam pelo menu: helper `downloadAs(formato)` clica em `role=button /^Baixar$/` e depois `role=menuitem /^<formato>$/` (PDF/A e JPG entram por aí). DOCX/ODT são conferidos descompactando o zip (fflate) e checando `word/document.xml`/`content.xml` (imagens `word/media/pageN.png`/`Pictures/pageN.png`, proporção IHDR ≈ 612/792, textos editáveis presentes via `w:framePr`/`fo:margin-top`, textos cobertos/apagados ausentes); JPG confere 2 downloads com assinatura `FF D8` salvos em `e2e/downloaded-pagina-N.jpg`; PDF/A confere `<pdfaid:part>3`/`conformance>B` no bytes.
- Rodapé/ajuda/idioma: marca, Ajuda ativa que abre/fecha a área Ajuda — título 'Ajuda e Informações', 2 caixas 'Informações'/'Ajuda' com títulos laranja centralizados/borda tracejada/negrito do nome do app, vídeo do YouTube 9JdHEaMH6Bo embutido na caixa 'Ajuda' (src com `vq=hd1080` e `cc_load_policy=0`, abaixo do texto e centralizado), linha em branco visível após a 2ª caixa, ícone do cabeçalho é link para `/`, menu de idioma (`menuitemradio`) abre acima do botão, troca de idioma p/ EN e volta a pt-BR.
- Metadados de marca (Author/Subject/Creator/Producer = `BRAND` de `src/lib/brand.ts`) conferidos no PDF exportado, nas partes da divisão, no PDF/A e dentro de DOCX/ODT.
- Screenshots em `e2e/shots/`. Falhas saem com exit 1 e lista de problemas.
- Warnings na saída são normais e não falham o teste: `Ensure that the standardFontDataUrl API parameter is provided` (vêm da conferência do PDF exportado no próprio script) e fallback de fonte (`Font ... is not available`).

## Convenções

- Textos de UI: chaves nos 4 dicionários de `src/lib/i18n.ts`; componentes com `useT()`, store com `translate(get().locale, ...)`. Interpolação via `{chave}` (ex.: `'{n} páginas'`); plural com chave separada (`pagesOne`/`pagesMany`).
- Nomes de classe CSS em kebab-case, sem CSS modules.
- Sem comentários no código exceto quando o porquê não é óbvio (ex.: geometria, ordem de índices).
- `patchActive`/`patchDoc` para mudanças de doc; ações de UI global (toast, exporting) via `set`.
