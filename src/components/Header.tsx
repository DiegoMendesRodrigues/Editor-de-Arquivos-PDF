/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useEffect, useRef, useState } from 'react';
import {
  EXPORT_FORMATS,
  MAX_DOCS,
  canOpenDoc,
  formatLabel,
  useEditor,
  type ExportFormat,
} from '../state/editorStore';
import { useT } from '../lib/useT';
import { DownloadIcon, MergeIcon, OpenIcon, SplitIcon } from './icons';

const BASE = import.meta.env.BASE_URL;

interface Props {
  onOpenClick: () => void;
}

export function Header({ onOpenClick }: Props) {
  const t = useT();
  const docs = useEditor((s) => s.docs);
  const activeId = useEditor((s) => s.activeId);
  const setActive = useEditor((s) => s.setActive);
  const requestCloseDoc = useEditor((s) => s.requestCloseDoc);
  const exporting = useEditor((s) => s.exporting);
  const merging = useEditor((s) => s.merging);
  const splitting = useEditor((s) => s.splitting);
  const exportAndDownload = useEditor((s) => s.exportAndDownload);
  const openMergeDialog = useEditor((s) => s.openMergeDialog);
  const activeReady = docs.some((d) => d.id === activeId && d.status === 'ready');
  const mergeCount = docs.filter((d) => d.status === 'ready').length;
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const formatMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora ou pressionar Esc (só enquanto está aberto).
  useEffect(() => {
    if (!formatMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setFormatMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFormatMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [formatMenuOpen]);

  const pickFormat = (format: ExportFormat) => {
    setFormatMenuOpen(false);
    void exportAndDownload(format);
  };

  // O store decide antes de abrir o seletor: assim o limite/aviso aparecem
  // mesmo quando ainda não há nenhum documento carregado, e o input de
  // arquivo não fica pendurado num chooser que ninguém vai preencher.
  const handleOpenClick = () => {
    const state = useEditor.getState();
    if (!canOpenDoc(state)) {
      state.setNotice(
        state.docs.some((d) => d.status === 'loading')
          ? t('waitLoading')
          : t('maxDocsNotice', { max: MAX_DOCS }),
      );
      return;
    }
    onOpenClick();
  };

  return (
    <header className="header">
      <div className="brand">
        <a href={BASE} title={t('appName')}>
          <img
            className="brand-logo"
            src={`${BASE}icone-editor-de-pdf.png`}
            alt={t('appName')}
            width={167}
            height={36}
          />
        </a>
      </div>

      {docs.length > 0 && (
        <div className="doc-tabs">
          {docs.map((d) => (
            <div
              key={d.id}
              className={`doc-tab${d.id === activeId ? ' active' : ''}${d.status === 'error' ? ' error' : ''}`}
              title={d.fileName}
              role="button"
              tabIndex={0}
              aria-current={d.id === activeId}
              onClick={() => setActive(d.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActive(d.id);
                }
              }}
            >
              <span className="doc-tab-name">
                {d.status === 'loading' ? t('openingTab', { name: d.fileName }) : d.fileName}
              </span>
              <button
                type="button"
                className="doc-tab-close"
                title={t('closeDocTooltip')}
                aria-label={t('closeDocAria', { name: d.fileName })}
                onClick={(e) => {
                  e.stopPropagation();
                  requestCloseDoc(d.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="header-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleOpenClick}
          title={
            docs.length >= MAX_DOCS
              ? t('openPdfMaxTitle', { max: MAX_DOCS })
              : t('openPdfNewTab')
          }
        >
          <OpenIcon width={16} height={16} />
          {t('openPdf')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={openMergeDialog}
          disabled={mergeCount < 2 || merging}
          title={mergeCount < 2 ? t('mergeNeedTwoPdf') : t('mergeDocumentsTitle')}
        >
          <MergeIcon width={16} height={16} />
          {t('mergeBtn')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => useEditor.getState().openSplitDialog()}
          disabled={!activeReady || splitting || exporting}
          title={activeReady ? t('splitDocTitle') : t('splitNoDocTitle')}
        >
          <SplitIcon width={16} height={16} />
          {t('splitBtn')}
        </button>
        <div className="download-group" ref={formatMenuRef}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormatMenuOpen((v) => !v)}
            disabled={!activeReady || exporting}
            aria-haspopup="menu"
            aria-expanded={formatMenuOpen}
            title={t('downloadTitle')}
          >
            <DownloadIcon width={16} height={16} />
            {exporting ? t('generating') : t('downloadBtn')}
          </button>
          {formatMenuOpen && (
            <div className="popup-menu" role="menu">
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  className="popup-menu-item"
                  onClick={() => pickFormat(format)}
                >
                  {formatLabel(format)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
