/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { strToU8, zipSync } from 'fflate';
import type { ExportPage } from './renderExport';
import type { TextRun } from './textExport';
import { BRAND } from './brand';

export interface OfficeOptions {
  /** Nome base do arquivo (vira título no metadado do ODT). */
  title?: string;
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';

/** Remove caracteres inválidos em XML 1.0 e escapa para texto/atributos. */
const esc = (s: string): string =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const EMU_PER_PT = 12700;
const TWIPS_PER_PT = 20;
/** Pontos → centímetros reais (o valor antigo saía em mm rotulado como cm). */
const cm = (pt: number): string => ((pt * 2.54) / 72).toFixed(2);

/* ------------------------------- DOCX (OOXML) ------------------------------ */

// Cada página vira uma imagem inline ocupando a largura da página, com página
// inteira de tamanho: o Word paginou imagens âncoras (flutuantes) empilhando
// todas na 1ª página; inline força a quebra de página real por página de imagem.
const docxImage = (page: ExportPage, id: number): string => {
  const cx = Math.round(page.widthPt * EMU_PER_PT);
  const cy = Math.round(page.heightPt * EMU_PER_PT);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:docPr id="${id}" name="Imagem ${id}"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Imagem ${id}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
};

/**
 * Parágrafo com moldura (framePr) posicionada na página: é texto de verdade,
 * editável, ancorado nas mesmas coordenadas do PNG de fundo.
 */
const docxTextFrame = (run: TextRun): string => {
  if (!run.text.trim() || !(run.sizePt > 0)) return '';
  const x = Math.round(run.x * TWIPS_PER_PT);
  const y = Math.round(run.yTop * TWIPS_PER_PT);
  const w = Math.max(500, Math.round((run.widthPt || run.sizePt * 8) * TWIPS_PER_PT));
  const sz = Math.max(2, Math.min(400, Math.round(run.sizePt * 2)));
  return `<w:p><w:pPr><w:framePr w:x="${x}" w:y="${y}" w:w="${w}" w:hRule="auto" w:wrap="none" w:vAnchor="page" w:hAnchor="page"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${sz}"/><w:color w:val="${run.color}"/>${run.bold ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${esc(run.text)}</w:t></w:r></w:p>`;
};

export function buildDocx(pages: ExportPage[]): Uint8Array {
  const body: string[] = [];
  pages.forEach((page, i) => {
    const pageBreak = i > 0 ? '<w:r><w:br w:type="page"/></w:r>' : '';
    body.push(
      `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:ind w:left="0" w:right="0"/><w:jc w:val="left"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>${pageBreak}${docxImage(page, i + 1)}</w:p>`,
    );
    for (const run of page.texts) body.push(docxTextFrame(run));
  });
  if (!body.length) body.push('<w:p/>');

  const first = pages[0];
  const w = Math.max(1, Math.round((first?.widthPt ?? 612) * TWIPS_PER_PT));
  const h = Math.max(1, Math.round((first?.heightPt ?? 792) * TWIPS_PER_PT));
  const documentXml = `${XML_DECL}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body.join('')}
<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

  const contentTypes = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const rootRels = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const coreXml = `${XML_DECL}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:subject>${esc(BRAND)}</dc:subject><dc:creator>${esc(BRAND)}</dc:creator><cp:lastModifiedBy>${esc(BRAND)}</cp:lastModifiedBy></cp:coreProperties>`;

  const appXml = `${XML_DECL}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>${esc(BRAND)}</Application></Properties>`;

  const imageRels = pages
    .map(
      (_, i) =>
        `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${i + 1}.png"/>`,
    )
    .join('');
  const docRels = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${imageRels}
</Relationships>`;

  const stylesXml = `${XML_DECL}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'docProps/core.xml': strToU8(coreXml),
    'docProps/app.xml': strToU8(appXml),
    'word/document.xml': strToU8(documentXml),
    'word/styles.xml': strToU8(stylesXml),
    'word/_rels/document.xml.rels': strToU8(docRels),
  };
  pages.forEach((page, i) => {
    files[`word/media/page${i + 1}.png`] = page.bytes;
  });
  return zipSync(files);
}

/* ---------------------------------- ODT ----------------------------------- */

const ODT_MIME = 'application/vnd.oasis.opendocument.text';

/** Estilo de texto por (tamanho, negrito, cor) usado nos spans. */
const odtTextStyle = (run: TextRun): string =>
  `T${run.bold ? 'b' : 'n'}${Math.round(run.sizePt)}-${run.color}`;

/**
 * Posiciona cada linha como parágrafo com margem superior/esquerda. O Word não
 * importa draw:frame de texto do ODF (só frames com imagem), então a posição
 * via margem é a única âncora que funciona em todos os consumidores. A imagem
 * da página fica ancorada à página (fora do fluxo) e não desloca os parágrafos.
 */
function layoutOdtTexts(
  page: ExportPage,
  pageIndex: number,
  body: string[],
  paraStyles: string[],
): void {
  const runs = page.texts
    .filter((r) => r.text.trim() && r.sizePt > 0)
    .slice()
    .sort((a, b) => a.yTop - b.yTop || a.x - b.x);
  let prevBottom = 0;
  runs.forEach((run, j) => {
    const name = `P${pageIndex}_${j}`;
    const marginTop = Math.max(0, run.yTop - prevBottom);
    prevBottom = run.yTop + run.sizePt * 1.25;
    paraStyles.push(
      `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="${cm(
        marginTop,
      )}cm" fo:margin-left="${cm(run.x)}cm" fo:margin-bottom="0cm" fo:margin-right="0cm" fo:line-height="100%"/></style:style>`,
    );
    body.push(
      `<text:p text:style-name="${name}"><text:span text:style-name="${odtTextStyle(
        run,
      )}">${esc(run.text)}</text:span></text:p>`,
    );
  });
}

export function buildOdt(pages: ExportPage[], opts: OfficeOptions = {}): Uint8Array {
  const body: string[] = [];
  const paraStyles: string[] = [];
  pages.forEach((page, i) => {
    if (i > 0) body.push('<text:p text:style-name="PageBreak"/>');
    const width = cm(page.widthPt);
    const height = cm(page.heightPt);
    body.push(
      `<text:p text:style-name="ImageP"><draw:frame text:anchor-type="page" draw:style-name="PageFrame" svg:width="${width}cm" svg:height="${height}cm"><draw:image xlink:href="Pictures/page${i + 1}.png" draw:mime-type="image/png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>`,
    );
    layoutOdtTexts(page, i, body, paraStyles);
  });
  if (!body.length) body.push('<text:p/>');

  // Estilos de texto por (tamanho, negrito, cor) usados nos spans.
  const styleKeys = new Set<string>();
  pages.forEach((page) =>
    page.texts.forEach((run) => {
      if (run.text.trim() && run.sizePt > 0) styleKeys.add(odtTextStyle(run));
    }),
  );
  const textStyles = [...styleKeys]
    .map((name) => {
      const m = /^T([bn])(\d+)-([0-9A-Fa-f]{6})$/.exec(name);
      if (!m) return '';
      const bold = m[1] === 'b';
      const size = m[2];
      const color = `#${m[3]}`;
      const weight = bold ? ' fo:font-weight="bold"' : '';
      return `<style:style style:name="${name}" style:family="text"><style:text-properties fo:font-size="${size}pt" fo:color="${color}"${weight}/></style:style>`;
    })
    .join('');

  const contentXml = `${XML_DECL}
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" office:version="1.3">
<office:automatic-styles>
<style:style style:name="PageFrame" style:family="graphic"><style:graphic-properties style:horizontal-pos="from-left" style:vertical-pos="from-top" style:horizontal-rel="page" style:vertical-rel="page" style:wrap="run-through" style:run-through="background" fo:margin-left="0cm" fo:margin-top="0cm"/></style:style>
<style:style style:name="ImageP" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin="0cm" fo:line-height="0.1cm"/><style:text-properties fo:font-size="1pt"/></style:style>
<style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:break-before="page" fo:margin-top="0cm" fo:margin-bottom="0cm" fo:line-height="0.1cm"/><style:text-properties fo:font-size="1pt"/></style:style>
${textStyles}
${paraStyles.join('')}
</office:automatic-styles>
<office:body><office:text>${body.join('')}</office:text></office:body>
</office:document-content>`;

  const first = pages[0];
  const pageWidth = cm(first?.widthPt ?? 612);
  const pageHeight = cm(first?.heightPt ?? 792);
  const printOrientation = (first?.widthPt ?? 612) > (first?.heightPt ?? 792) ? 'landscape' : 'portrait';
  const stylesXml = `${XML_DECL}
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3">
<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="${pageWidth}cm" fo:page-height="${pageHeight}cm" style:print-orientation="${printOrientation}" fo:margin="0cm"/></style:page-layout></office:automatic-styles>
<office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:line-height="115%"/><style:text-properties fo:color="#000000"/></style:default-style><style:style style:name="Standard" style:family="paragraph" style:class="text"/></office:styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
</office:document-styles>`;

  const metaXml = `${XML_DECL}
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3">
<office:meta>${opts.title ? `<dc:title>${esc(opts.title)}</dc:title>` : ''}<dc:subject>${esc(BRAND)}</dc:subject><dc:creator>${esc(BRAND)}</dc:creator><meta:initial-creator>${esc(BRAND)}</meta:initial-creator><meta:generator>${esc(BRAND)}</meta:generator></office:meta>
</office:document-meta>`;

  const pictureEntries = pages
    .map(
      (_, i) =>
        `<manifest:file-entry manifest:full-path="Pictures/page${i + 1}.png" manifest:media-type="image/png"/>`,
    )
    .join('');
  const manifestXml = `${XML_DECL}
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="${ODT_MIME}"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${pictureEntries}
</manifest:manifest>`;

  // ODF exige `mimetype` como 1º item do pacote e sem compressão (level 0).
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8(ODT_MIME), { level: 0 }],
    'META-INF/manifest.xml': strToU8(manifestXml),
    'content.xml': strToU8(contentXml),
    'styles.xml': strToU8(stylesXml),
    'meta.xml': strToU8(metaXml),
  };
  pages.forEach((page, i) => {
    files[`Pictures/page${i + 1}.png`] = page.bytes;
  });
  return zipSync(files);
}
