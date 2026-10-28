/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { EditorElement, PageInfo, PageRange, Rect, Tool } from '../lib/types';
import { openPdf, readPageInfo } from '../lib/pdfSource';
import { buildPdf, buildPdfA, mergePdfs, splitPdf } from '../lib/pdfExport';
import { buildDocx, buildOdt } from '../lib/officeExport';
import { renderPageImages } from '../lib/renderExport';
import { extractExportTexts } from '../lib/textExport';
import { isImageFile, readImageFile } from '../lib/imageUtils';
import { clamp, clampRectToPage, uid } from '../lib/geometry';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, translate, type Locale, type TFunction } from '../lib/i18n';

const HISTORY_LIMIT = 60;
const COALESCE_MS = 700;
export const MAX_DOCS = 3;

// Evita que duas aberturas simultâneas disputem o mesmo input de arquivo
// (o click do input é cancelado e a aba fica presa em "Abrindo…").
let openToken = 0;

const initialLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // sem localStorage (ambiente restrito)
  }
  return DEFAULT_LOCALE;
};

export type ExportFormat = 'pdf' | 'docx' | 'odt' | 'jpg' | 'pdfa';

export const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'docx', 'odt', 'jpg', 'pdfa'];

/** Rótulo do formato no menu (PDF/A mantém a barra; os demais só caixa alta). */
export const formatLabel = (format: ExportFormat): string =>
  format === 'pdfa' ? 'PDF/A' : format.toUpperCase();

const FORMAT_MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  jpg: 'image/jpeg',
  pdfa: 'application/pdf',
};

export type ImageTarget =
  | { mode: 'point'; pageIndex: number; x: number; y: number }
  | { mode: 'region'; pageIndex: number; rect: Rect };

interface CoalesceState {
  key: string;
  time: number;
}

/** Instantâneo de histórico: elementos + páginas removidas (undo/redo). */
interface DocSnapshot {
  elements: EditorElement[];
  deletedPages: number[];
}

export interface DocState {
  id: string;
  fileName: string;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  doc: PDFDocumentProxy | null;
  bytes: Uint8Array | null;
  pages: PageInfo[];
  /** Índices (originais) das páginas removidas pelo usuário. */
  deletedPages: number[];
  pageIndex: number;
  zoom: number;
  fitMode: boolean;
  elements: EditorElement[];
  selectedId: string | null;
  editingId: string | null;
  past: DocSnapshot[];
  future: DocSnapshot[];
  lastCoalesce: CoalesceState | null;
}

interface EditorState {
  docs: DocState[];
  activeId: string | null;
  closingDocId: string | null;
  tool: Tool;
  notice: string | null;
  exporting: boolean;
  dragOver: boolean;
  clipboard: EditorElement | null;
  /** Índice da página a excluir (aguardando confirmação), ou null. */
  pendingDeletePage: number | null;
  /** Diálogo de mesclagem aberto. */
  mergeOpen: boolean;
  /** Ids dos documentos selecionados para mesclar (ordem = ordem das abas). */
  mergeIds: string[];
  merging: boolean;
  /** Diálogo de divisão aberto. */
  splitOpen: boolean;
  splitting: boolean;
  /** Área Ajuda aberta. */
  helpOpen: boolean;
  /** Idioma da interface. */
  locale: Locale;

  openFile: (file: File) => Promise<void>;
  setActive: (id: string) => void;
  requestCloseDoc: (id: string) => void;
  confirmClose: () => void;
  cancelClose: () => void;
  closeDocImmediate: (id: string) => void;
  setTool: (tool: Tool) => void;
  setPageIndex: (index: number) => void;
  setZoom: (zoom: number, opts?: { keepFit?: boolean }) => void;
  setFitMode: (fit: boolean) => void;
  setDragOver: (v: boolean) => void;
  setNotice: (msg: string | null) => void;
  select: (id: string | null) => void;
  beginTextEdit: (id: string, opts?: { skipHistory?: boolean }) => void;
  endTextEdit: () => void;
  pushHistory: () => void;
  addElement: (el: EditorElement) => void;
  updateElement: (id: string, patch: Partial<EditorElement>, opts?: { coalesce?: string }) => void;
  setElementRect: (id: string, rect: Rect, opts?: { coalesce?: string }) => void;
  removeElement: (id: string) => void;
  undo: () => void;
  redo: () => void;
  placeImage: (file: File, target: ImageTarget) => Promise<void>;
  materializeImageRegion: (pageIndex: number, rect: Rect, src: string, bg: string) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  exportAndDownload: (format: ExportFormat) => Promise<void>;
  requestDeletePage: (index: number) => void;
  confirmDeletePage: () => void;
  cancelDeletePage: () => void;
  openMergeDialog: () => void;
  closeMergeDialog: () => void;
  toggleMergeId: (id: string) => void;
  mergeAndDownload: () => Promise<void>;
  openSplitDialog: () => void;
  closeSplitDialog: () => void;
  splitAndDownload: (ranges: PageRange[]) => Promise<void>;
  toggleHelp: () => void;
  setLocale: (locale: Locale) => void;
}

export const activeDoc = (s: EditorState): DocState | null =>
  s.docs.find((d) => d.id === s.activeId) ?? null;

export const useActiveDoc = (): DocState | null => useEditor(activeDoc);

/** true se ainda dá para abrir outro documento (respeita o limite e o carregamento). */
export const canOpenDoc = (s: EditorState): boolean =>
  !s.docs.some((d) => d.status === 'loading') && s.docs.length < MAX_DOCS;

/** Páginas visíveis (não removidas) de um documento. */
export const visiblePages = (d: DocState | null): PageInfo[] => {
  if (!d) return [];
  const gone = new Set(d.deletedPages);
  return d.pages.filter((_, i) => !gone.has(i));
};

const errMsg = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const cloneElement = (el: EditorElement, offset = 16): EditorElement => {
  const rect = { ...el.rect, x: el.rect.x + offset, y: el.rect.y + offset };
  if (el.kind === 'text') {
    return { ...el, id: uid(), rect, origin: { x: el.origin.x + offset, y: el.origin.y + offset } };
  }
  return { ...el, id: uid(), rect };
};

/** Baixa um Uint8Array como arquivo no formato informado (extensão/MIME). */
const downloadFile = (bytes: Uint8Array, fileName: string, format: ExportFormat) => {
  const blob = new Blob([new Uint8Array(bytes)], { type: FORMAT_MIME[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
};

const newDocState = (id: string, fileName: string): DocState => ({
  id,
  fileName,
  status: 'loading',
  error: null,
  doc: null,
  bytes: null,
  pages: [],
  deletedPages: [],
  pageIndex: 0,
  zoom: 1,
  fitMode: false,
  elements: [],
  selectedId: null,
  editingId: null,
  past: [],
  future: [],
  lastCoalesce: null,
});

export const useEditor = create<EditorState>((set, get) => {
  const patchDoc = (
    id: string | null,
    patch: Partial<DocState> | ((d: DocState) => Partial<DocState>),
  ) =>
    set((s) => ({
      docs: s.docs.map((d) =>
        d.id === (id ?? s.activeId) ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d,
      ),
    }));

  const patchActive = (patch: Partial<DocState> | ((d: DocState) => Partial<DocState>)) =>
    patchDoc(get().activeId, patch);

  const t: TFunction = (key, vars) => translate(get().locale, key, vars);

  return {
    docs: [],
    activeId: null,
    closingDocId: null,
    tool: 'select',
    notice: null,
    exporting: false,
    dragOver: false,
    clipboard: null,
    pendingDeletePage: null,
    mergeOpen: false,
    mergeIds: [],
    merging: false,
    splitOpen: false,
    splitting: false,
    helpOpen: false,
    locale: initialLocale(),

    openFile: async (file) => {
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        set({ notice: t('selectPdfFile') });
        return;
      }
      if (get().docs.some((d) => d.status === 'loading')) {
        set({ notice: t('waitLoading') });
        return;
      }
      if (get().docs.length >= MAX_DOCS) {
        set({ notice: t('maxDocsNotice', { max: MAX_DOCS }) });
        return;
      }
      const id = uid();
      openToken += 1;
      const token = openToken;
      set((s) => ({
        docs: [...s.docs, newDocState(id, file.name)],
        activeId: id,
        notice: null,
      }));
      try {
        const { doc, bytes } = await openPdf(file);
        const pages: PageInfo[] = [];
        for (let i = 0; i < doc.numPages; i++) {
          pages.push(await readPageInfo(doc, i));
        }
        if (token !== openToken) return;
        patchDoc(id, { status: 'ready', error: null, doc, bytes, pages });
      } catch (err) {
        if (token !== openToken) return;
        console.error(err);
        const isPassword =
          err instanceof Error && (err.name === 'PasswordException' || /password/i.test(err.message));
        patchDoc(id, {
          status: 'error',
          error: isPassword
            ? t('passwordPdf')
            : t('openPdfError', { msg: errMsg(err) }),
        });
      }
    },

    setActive: (id) => {
      if (!get().docs.some((d) => d.id === id)) return;
      set({ activeId: id });
    },

    requestCloseDoc: (id) => {
      const doc = get().docs.find((d) => d.id === id);
      if (!doc) return;
      if (doc.elements.length > 0) {
        set({ closingDocId: id });
        return;
      }
      get().closeDocImmediate(id);
    },

    confirmClose: () => {
      const id = get().closingDocId;
      set({ closingDocId: null });
      if (id) get().closeDocImmediate(id);
    },

    cancelClose: () => set({ closingDocId: null }),

    closeDocImmediate: (id) =>
      set((s) => {
        const idx = s.docs.findIndex((d) => d.id === id);
        if (idx === -1) return s;
        const docs = s.docs.filter((d) => d.id !== id);
        let activeId = s.activeId;
        if (s.activeId === id) {
          activeId = docs.length ? docs[Math.min(idx, docs.length - 1)].id : null;
        }
        return { docs, activeId, closingDocId: s.closingDocId === id ? null : s.closingDocId };
      }),

    setTool: (tool) => {
      patchActive({ editingId: null });
      set({ tool });
    },

    setPageIndex: (index) =>
      patchActive((d) => ({
        pageIndex: clamp(Math.round(index), 0, Math.max(0, d.pages.length - 1)),
      })),

    setZoom: (zoom, opts) =>
      patchActive((d) => ({
        zoom: clamp(zoom, 0.25, 4),
        fitMode: opts?.keepFit ? d.fitMode : false,
      })),

    setFitMode: (fit) => patchActive({ fitMode: fit }),

    setDragOver: (dragOver) => set({ dragOver }),

    setNotice: (notice) => set({ notice }),

    select: (id) => patchActive({ selectedId: id }),

    beginTextEdit: (id, opts) => {
      if (!opts?.skipHistory) get().pushHistory();
      patchActive({
        editingId: id,
        selectedId: id,
        lastCoalesce: { key: `text-${id}`, time: Date.now() },
      });
    },

    endTextEdit: () => patchActive({ editingId: null }),

    pushHistory: () =>
      patchActive((d) => ({
        past: [
          ...d.past.slice(-(HISTORY_LIMIT - 1)),
          { elements: d.elements, deletedPages: d.deletedPages },
        ],
        future: [],
        lastCoalesce: null,
      })),

    addElement: (el) => {
      get().pushHistory();
      patchActive((d) => ({
        elements: [...d.elements, el],
        selectedId: el.id,
        editingId: null,
      }));
    },

    updateElement: (id, patch, opts) =>
      patchActive((d) => {
        const now = Date.now();
        const key = opts?.coalesce;
        const canCoalesce =
          !!key &&
          !!d.lastCoalesce &&
          d.lastCoalesce.key === key &&
          now - d.lastCoalesce.time < COALESCE_MS;
        const elements = d.elements.map((el) =>
          el.id === id ? ({ ...el, ...patch } as EditorElement) : el,
        );
        return {
          elements,
          past: canCoalesce
            ? d.past
            : [
                ...d.past.slice(-(HISTORY_LIMIT - 1)),
                { elements: d.elements, deletedPages: d.deletedPages },
              ],
          future: canCoalesce ? d.future : [],
          lastCoalesce: key ? { key, time: now } : null,
        };
      }),

    setElementRect: (id, rect, opts) => {
      const el = activeDoc(get())?.elements.find((e) => e.id === id);
      if (!el) return;
      if (el.kind === 'text') {
        const dx = rect.x - el.rect.x;
        const dy = rect.y - el.rect.y;
        get().updateElement(
          id,
          { rect, origin: { x: el.origin.x + dx, y: el.origin.y + dy } },
          opts,
        );
      } else {
        get().updateElement(id, { rect }, opts);
      }
    },

    removeElement: (id) => {
      get().pushHistory();
      patchActive((d) => ({
        elements: d.elements.filter((e) => e.id !== id),
        selectedId: d.selectedId === id ? null : d.selectedId,
        editingId: d.editingId === id ? null : d.editingId,
      }));
    },

    undo: () =>
      patchActive((d) => {
        if (!d.past.length) return {};
        const snap = d.past[d.past.length - 1];
        const selectedId = snap.elements.some((e) => e.id === d.selectedId) ? d.selectedId : null;
        return {
          elements: snap.elements,
          deletedPages: snap.deletedPages,
          past: d.past.slice(0, -1),
          future: [
            { elements: d.elements, deletedPages: d.deletedPages },
            ...d.future,
          ].slice(0, HISTORY_LIMIT),
          selectedId,
          editingId: null,
          lastCoalesce: null,
        };
      }),

    redo: () =>
      patchActive((d) => {
        if (!d.future.length) return {};
        const snap = d.future[0];
        const selectedId = snap.elements.some((e) => e.id === d.selectedId) ? d.selectedId : null;
        return {
          elements: snap.elements,
          deletedPages: snap.deletedPages,
          past: [
            ...d.past.slice(-(HISTORY_LIMIT - 1)),
            { elements: d.elements, deletedPages: d.deletedPages },
          ],
          future: d.future.slice(1),
          selectedId,
          editingId: null,
          lastCoalesce: null,
        };
      }),

    placeImage: async (file, target) => {
      if (!isImageFile(file)) {
        set({ notice: t('invalidImage') });
        return;
      }
      try {
        const img = await readImageFile(file);
        const meta = activeDoc(get())?.pages[target.pageIndex];
        if (!meta) return;
        let rect: Rect;
        if (target.mode === 'region') {
          rect = clampRectToPage(target.rect, meta.width, meta.height);
        } else {
          const maxW = Math.min(img.width, meta.width * 0.5, 480);
          const maxH = Math.min(img.height, meta.height * 0.5, 480);
          const scale = Math.min(1, maxW / img.width, maxH / img.height);
          const w = Math.max(24, img.width * scale);
          const h = Math.max(24, img.height * scale);
          rect = clampRectToPage(
            { x: target.x - w / 2, y: target.y - h / 2, w, h },
            meta.width,
            meta.height,
          );
        }
        get().addElement({
          id: uid(),
          page: target.pageIndex,
          kind: 'image',
          rect,
          src: img.src,
          opacity: 1,
        });
        set({ tool: 'select' });
      } catch (err) {
        set({ notice: errMsg(err) });
      }
    },

    materializeImageRegion: (pageIndex, rect, src, bg) => {
      get().pushHistory();
      patchActive((d) => {
        const erase: EditorElement = {
          id: uid(),
          page: pageIndex,
          kind: 'erase',
          rect: { ...rect },
          color: bg,
        };
        const image: EditorElement = {
          id: uid(),
          page: pageIndex,
          kind: 'image',
          rect: { ...rect },
          src,
          opacity: 1,
        };
        return {
          elements: [erase, image, ...d.elements],
          selectedId: image.id,
          editingId: null,
        };
      });
      set({
        tool: 'select',
        notice: t('imagePlacedNotice'),
      });
    },

    copySelected: () => {
      const d = activeDoc(get());
      const selected = d?.elements.find((e) => e.id === d.selectedId);
      if (!selected) return;
      set({ clipboard: selected, notice: t('elementCopied') });
    },

    pasteClipboard: () => {
      const cb = get().clipboard;
      const d = activeDoc(get());
      if (!cb || !d) return;
      const clone = cloneElement(cb, 20);
      const meta = d.pages[clone.page];
      if (meta) clone.rect = clampRectToPage(clone.rect, meta.width, meta.height);
      get().addElement(clone);
    },

    duplicateSelected: () => {
      const d = activeDoc(get());
      const el = d?.elements.find((e) => e.id === d.selectedId);
      if (!d || !el) return;
      const clone = cloneElement(el, 24);
      const meta = d.pages[clone.page];
      if (meta) clone.rect = clampRectToPage(clone.rect, meta.width, meta.height);
      get().addElement(clone);
    },

    exportAndDownload: async (format) => {
      const s = get();
      const d = activeDoc(s);
      if (!d || d.status !== 'ready' || !d.bytes || s.exporting) return;
      set({ exporting: true, notice: null });
      const baseName = d.fileName.replace(/\.pdf$/i, '');
      try {
        if (format === 'pdf') {
          const out = await buildPdf(d.bytes, d.elements, d.pages, d.deletedPages);
          downloadFile(out, `${baseName}-editado.pdf`, 'pdf');
          set({ notice: t('exportOk') });
          return;
        }
        if (format === 'jpg') {
          // Uma JPEG por página; espaçamento de 300 ms evita o bloqueio de
          // downloads múltiplos pelo navegador (mesma tática da divisão).
          const edited = await buildPdf(d.bytes, d.elements, d.pages, d.deletedPages);
          const images = await renderPageImages(edited, { type: 'jpeg', quality: 0.92 });
          for (let i = 0; i < images.length; i++) {
            downloadFile(images[i].bytes, `${baseName}-pagina-${i + 1}.jpg`, 'jpg');
            if (i < images.length - 1) await new Promise((resolve) => setTimeout(resolve, 300));
          }
          set({ notice: t('exportFmtOk', { fmt: formatLabel('jpg') }) });
          return;
        }
        if (format === 'pdfa') {
          const out = await buildPdfA(d.bytes, d.elements, d.pages, d.deletedPages, baseName);
          downloadFile(out, `${baseName}-pdfa.pdf`, 'pdfa');
          set({ notice: t('exportFmtOk', { fmt: formatLabel('pdfa') }) });
          return;
        }
        // DOCX/ODT híbrido: monta um PDF com o texto original apagado (os
        // furos brancos) e o texto do usuário reduzido à sua caixa de cover,
        // renderiza cada página como imagem de fundo (tabelas/cores/imagens
        // preservadas) e reinsere todos os textos como texto editável por cima.
        const texts = d.doc ? await extractExportTexts(d.doc, d.elements, d.deletedPages) : [];
        const holes: EditorElement[] = texts.flatMap((p) =>
          p.holes.map((rect, i) => ({
            id: `__hole_${p.pageIndex}_${i}`,
            page: p.pageIndex,
            kind: 'erase' as const,
            rect,
            color: '#ffffff',
          })),
        );
        const gfx = d.elements
          .map((el): EditorElement | null => {
            if (el.kind !== 'text') return el;
            if (!el.cover) return null;
            return {
              id: el.id,
              page: el.page,
              kind: 'rect',
              rect: el.rect,
              fill: el.cover,
              stroke: 'transparent',
              strokeWidth: 0,
              opacity: 1,
            };
          })
          .filter((el): el is EditorElement => el !== null);
        const edited = await buildPdf(d.bytes, [...holes, ...gfx], d.pages, d.deletedPages);
        const images = await renderPageImages(edited);
        const pages = images.map((img, i) => ({ ...img, texts: texts[i]?.runs ?? [] }));
        const out = format === 'docx' ? buildDocx(pages) : buildOdt(pages, { title: baseName });
        downloadFile(out, `${baseName}-editado.${format}`, format);
        set({ notice: t('exportFmtOk', { fmt: formatLabel(format) }) });
      } catch (err) {
        console.error(err);
        set({
          notice:
            format === 'pdf'
              ? t('exportErr', { msg: errMsg(err) })
              : t('exportFmtErr', { fmt: formatLabel(format), msg: errMsg(err) }),
        });
      } finally {
        set({ exporting: false });
      }
    },

    requestDeletePage: (index) => {
      const d = activeDoc(get());
      if (!d || d.status !== 'ready') return;
      const gone = new Set(d.deletedPages);
      const remaining = d.pages.length - gone.size;
      if (remaining < 2) {
        set({ notice: t('needOnePage') });
        return;
      }
      if (gone.has(index)) return;
      set({ pendingDeletePage: index });
    },

    confirmDeletePage: () => {
      const index = get().pendingDeletePage;
      set({ pendingDeletePage: null });
      if (index === null) return;
      const d = activeDoc(get());
      if (!d) return;
      get().pushHistory();
      const gone = new Set([...d.deletedPages, index]);
      const remaining = d.pages.filter((_, i) => !gone.has(i));
      // Remove elementos que estavam na página excluída
      const elements = d.elements.filter((e) => e.page !== index);
      // Ajusta a página atual se ela foi a excluída
      let pageIndex = d.pageIndex;
      if (gone.has(pageIndex)) {
        const first = remaining[0];
        pageIndex = first ? first.index : 0;
      }
      patchActive({
        deletedPages: [...gone].sort((a, b) => a - b),
        elements,
        pageIndex,
        selectedId: null,
        editingId: null,
      });
      set({ notice: t('pageDeleted', { n: index + 1 }) });
    },

    cancelDeletePage: () => set({ pendingDeletePage: null }),

    openMergeDialog: () => {
      const s = get();
      const ready = s.docs.filter((d) => d.status === 'ready');
      if (ready.length < 2) {
        set({ notice: t('needTwoDocsMerge') });
        return;
      }
      // Pré-seleciona todos os documentos prontos
      set({ mergeOpen: true, mergeIds: ready.map((d) => d.id) });
    },

    closeMergeDialog: () => set({ mergeOpen: false }),

    toggleMergeId: (id) =>
      set((s) => ({
        mergeIds: s.mergeIds.includes(id)
          ? s.mergeIds.filter((x) => x !== id)
          : [...s.mergeIds, id],
      })),

    mergeAndDownload: async () => {
      const s = get();
      if (s.merging || s.exporting) return;
      // Ordem = ordem das abas (docs array), filtrando apenas os selecionados e prontos
      const selected = s.docs.filter((d) => s.mergeIds.includes(d.id) && d.status === 'ready');
      if (selected.length < 2) {
        set({ notice: t('selectTwoDocs') });
        return;
      }
      set({ merging: true, notice: null });
      try {
        // Aplica as edições de cada documento antes da mesclagem
        const editedParts: Uint8Array[] = [];
        for (const d of selected) {
          const part = await buildPdf(d.bytes!, d.elements, d.pages, d.deletedPages);
          editedParts.push(part);
        }
        const merged = await mergePdfs(editedParts);
        const baseName = selected[0].fileName.replace(/\.pdf$/i, '');
        downloadFile(merged, `${baseName}-e-mais-${selected.length - 1}-mesclado.pdf`, 'pdf');
        set({
          mergeOpen: false,
          notice: t('mergeOkMany', { n: selected.length }),
        });
      } catch (err) {
        console.error(err);
        set({ notice: t('mergeErr', { msg: errMsg(err) }) });
      } finally {
        set({ merging: false });
      }
    },

    openSplitDialog: () => {
      const d = activeDoc(get());
      if (!d || d.status !== 'ready') {
        set({ notice: t('splitNoDoc') });
        return;
      }
      set({ splitOpen: true });
    },

    closeSplitDialog: () => set({ splitOpen: false }),

    splitAndDownload: async (ranges) => {
      const s = get();
      const d = activeDoc(s);
      if (!d || d.status !== 'ready' || !d.bytes || s.splitting || s.exporting) return;
      if (!ranges.length) {
        set({ notice: t('needRanges') });
        return;
      }
      set({ splitting: true, notice: null });
      try {
        const built = await buildPdf(d.bytes, d.elements, d.pages, d.deletedPages);
        const parts = await splitPdf(built, ranges);
        const baseName = d.fileName.replace(/\.pdf$/i, '');
        for (let i = 0; i < parts.length; i++) {
          downloadFile(parts[i], `${baseName}-parte-${i + 1}.pdf`, 'pdf');
          // Pequena pausa para o navegador não bloquear downloads em sequência
          if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 300));
        }
        set({
          splitOpen: false,
          notice: parts.length === 1 ? t('splitOkOne') : t('splitOkMany', { n: parts.length }),
        });
      } catch (err) {
        console.error(err);
        set({ notice: t('splitErr', { msg: errMsg(err) }) });
      } finally {
        set({ splitting: false });
      }
    },

    toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

    setLocale: (locale) => {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
        // sem localStorage (ambiente restrito)
      }
      document.documentElement.lang = locale;
      set({ locale });
    },
  };
});

document.documentElement.lang = useEditor.getState().locale;

export const editorActions = () => useEditor.getState();
