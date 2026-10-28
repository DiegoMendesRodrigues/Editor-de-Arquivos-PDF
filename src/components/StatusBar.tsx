/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { activeDoc, useEditor, visiblePages } from '../state/editorStore';
import type { Tool } from '../lib/types';
import type { MessageKey } from '../lib/i18n';
import { useT } from '../lib/useT';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FitIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './icons';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const TOOL_HINTS: Record<Tool, MessageKey> = {
  select: 'hintSelect',
  text: 'hintText',
  image: 'hintImage',
  rect: 'hintRect',
  highlight: 'hintHighlight',
  eraser: 'hintEraser',
};

export function StatusBar() {
  const t = useT();
  const d = useEditor(activeDoc);
  const fileName = d?.fileName ?? '';
  const elements = d?.elements ?? [];
  const visPages = visiblePages(d);
  const pageIndex = d?.pageIndex ?? 0;
  const setPageIndex = useEditor((s) => s.setPageIndex);
  const zoom = d?.zoom ?? 1;
  const setZoom = useEditor((s) => s.setZoom);
  const fitMode = d?.fitMode ?? false;
  const setFitMode = useEditor((s) => s.setFitMode);
  const tool = useEditor((s) => s.tool);
  const requestDeletePage = useEditor((s) => s.requestDeletePage);

  const total = visPages.length;
  // Posição da página atual entre as visíveis (1-based)
  const currentPos = Math.max(
    0,
    visPages.findIndex((p) => p.index === pageIndex),
  );
  const canDelete = total >= 2;

  const stepZoom = (dir: 1 | -1) => {
    const idx = ZOOM_STEPS.findIndex((z) => z >= zoom - 0.001);
    const cur = idx === -1 ? ZOOM_STEPS.length - 1 : idx;
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, cur + dir));
    setZoom(ZOOM_STEPS[next]);
  };

  return (
    <footer className="statusbar">
      <div className="status-left" title={fileName}>
        <span className="status-file">{fileName}</span>
        <span className="status-count">
          {elements.length === 1
            ? t('changesOne', { n: elements.length })
            : t('changesMany', { n: elements.length })}
        </span>
      </div>

      <div className="status-center">
        <button
          type="button"
          className="icon-btn"
          title={t('prevPage')}
          disabled={currentPos <= 0}
          onClick={() => {
            const prev = visPages[currentPos - 1];
            if (prev) setPageIndex(prev.index);
          }}
        >
          <ChevronLeftIcon width={16} height={16} />
        </button>
        <label className="page-label">
          {t('pageLabel')}
          <input
            type="number"
            min={1}
            max={Math.max(1, total)}
            value={currentPos + 1}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              const target = visPages[Math.min(Math.max(v - 1, 0), total - 1)];
              if (target) setPageIndex(target.index);
            }}
          />
          <span>/ {total}</span>
        </label>
        <button
          type="button"
          className="icon-btn"
          title={t('nextPage')}
          disabled={currentPos >= total - 1}
          onClick={() => {
            const next = visPages[currentPos + 1];
            if (next) setPageIndex(next.index);
          }}
        >
          <ChevronRightIcon width={16} height={16} />
        </button>
        <button
          type="button"
          className="icon-btn status-delete-page"
          title={canDelete ? t('deletePageTooltip') : t('deletePageMinTwo')}
          disabled={!canDelete}
          onClick={() => requestDeletePage(pageIndex)}
        >
          <TrashIcon width={15} height={15} />
        </button>
      </div>

      <div className="status-right">
        <span className="tool-hint">{t(TOOL_HINTS[tool])}</span>
        <div className="zoom-group">
          <button type="button" className="icon-btn" title={t('zoomOut')} onClick={() => stepZoom(-1)}>
            <ZoomOutIcon width={16} height={16} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn" title={t('zoomIn')} onClick={() => stepZoom(1)}>
            <ZoomInIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className={`icon-btn${fitMode ? ' active' : ''}`}
            title={t('fitWidth')}
            onClick={() => setFitMode(!fitMode)}
          >
            <FitIcon width={16} height={16} />
          </button>
        </div>
      </div>
    </footer>
  );
}
