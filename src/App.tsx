/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useEffect, useRef } from 'react';
import { activeDoc, useEditor } from './state/editorStore';
import { isImageFile } from './lib/imageUtils';
import { useT } from './lib/useT';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Viewer } from './components/Viewer';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';
import { Footer } from './components/Footer';
import { EmptyState } from './components/EmptyState';
import { MergeDialog } from './components/MergeDialog';
import { SplitDialog } from './components/SplitDialog';
import { HelpView } from './components/HelpView';

const TOOL_KEYS: Record<string, string> = {
  v: 'select',
  t: 'text',
  i: 'image',
  r: 'rect',
  h: 'highlight',
  e: 'eraser',
};

export default function App() {
  const t = useT();
  const active = useEditor(activeDoc);
  const status = active ? active.status : 'empty';
  const dragOver = useEditor((s) => s.dragOver);
  const notice = useEditor((s) => s.notice);
  const closingDoc = useEditor((s) => s.docs.find((d) => d.id === s.closingDocId) ?? null);
  const pendingDeletePage = useEditor((s) => s.pendingDeletePage);
  const helpOpen = useEditor((s) => s.helpOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setDragOver = useEditor.getState().setDragOver;
    let depth = 0;

    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDragOver(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const state = useEditor.getState();
      const doc = activeDoc(state);

      if (doc?.status === 'ready' && isImageFile(file)) {
        const node = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest('[data-page]') as HTMLElement | null;
        const pageIndex = node ? Number(node.dataset.page) : doc.pageIndex;
        const page = doc.pages[pageIndex];
        if (page && node) {
          const r = node.getBoundingClientRect();
          void state.placeImage(file, {
            mode: 'point',
            pageIndex,
            x: (e.clientX - r.left) / doc.zoom,
            y: (e.clientY - r.top) / doc.zoom,
          });
        }
        return;
      }
      void state.openFile(file);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = useEditor.getState();
      const doc = activeDoc(state);
      if (!doc || doc.status !== 'ready') return;

      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'c' && !typing && doc.selectedId) {
          e.preventDefault();
          state.copySelected();
          return;
        }
        if (k === 'v' && !typing) {
          e.preventDefault();
          state.pasteClipboard();
          return;
        }
        if (k === 'd' && !typing) {
          e.preventDefault();
          state.duplicateSelected();
          return;
        }
      }

      if (typing) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (doc.selectedId && !doc.editingId) {
          e.preventDefault();
          state.removeElement(doc.selectedId);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (doc.editingId) state.endTextEdit();
        else {
          state.select(null);
          state.setTool('select');
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOL_KEYS[e.key.toLowerCase()];
        if (tool) state.setTool(tool as never);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useEditor.getState().setNotice(null), 4200);
    return () => clearTimeout(t);
  }, [notice]);

  const openFilePicker = () => fileInputRef.current?.click();

  return (
    <div className="app">
      <Header onOpenClick={openFilePicker} />

      {helpOpen ? (
        <HelpView />
      ) : (
        <div className="workspace">
          {status === 'ready' && <Toolbar />}
          <main className="main">
            {status === 'empty' && <EmptyState onOpenClick={openFilePicker} />}
            {status === 'loading' && (
              <div className="center-msg">
                <div className="spinner" />
                <p>{t('loadingPdf')}</p>
              </div>
            )}
            {status === 'error' && (
              <div className="center-msg">
                <div className="error-card">
                  <h2>{t('openErrorTitle')}</h2>
                  <p>{active?.error}</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => active && useEditor.getState().requestCloseDoc(active.id)}
                  >
                    {t('closeDocBtn')}
                  </button>
                </div>
              </div>
            )}
            {active && status === 'ready' && <Viewer key={active.id} />}
          </main>
          {status === 'ready' && <PropertiesPanel />}
        </div>
      )}

      {status === 'ready' && !helpOpen && <StatusBar />}

      <Footer />

      {dragOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-box">
            <strong>
              {status === 'ready' ? t('dragReadyTitle') : t('dragEmptyTitle')}
            </strong>
            <span>{status === 'ready' ? t('dragReadySub') : t('dragEmptySub')}</span>
          </div>
        </div>
      )}

      {closingDoc && (
        <div className="modal-backdrop" onClick={() => useEditor.getState().cancelClose()}>
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="close-doc-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="close-doc-title">{t('closeDocTitle')}</h2>
            <p>
              {t('closeDocBefore')}
              <strong>{closingDoc.fileName}</strong>
              {t('closeDocAfter')}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => useEditor.getState().cancelClose()}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => useEditor.getState().confirmClose()}
              >
                {t('closeDiscard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeletePage !== null && (
        <div className="modal-backdrop" onClick={() => useEditor.getState().cancelDeletePage()}>
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-page-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-page-title">{t('deletePageTitle')}</h2>
            <p>
              {t('deletePageBefore')}
              <strong>{pendingDeletePage + 1}</strong>
              {t('deletePageAfter')}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => useEditor.getState().cancelDeletePage()}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => useEditor.getState().confirmDeletePage()}
              >
                {t('deletePageConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <MergeDialog />

      <SplitDialog />

      {notice && <div className="toast">{notice}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void useEditor.getState().openFile(file);
        }}
      />
    </div>
  );
}
