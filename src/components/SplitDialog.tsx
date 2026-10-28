/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useState } from 'react';
import { activeDoc, useEditor } from '../state/editorStore';
import { defaultRanges, parsePageRanges } from '../lib/splitRanges';
import { useT } from '../lib/useT';

export function SplitDialog() {
  const open = useEditor((s) => s.splitOpen);
  const doc = useEditor(activeDoc);
  if (!open) return null;
  const total = doc ? doc.pages.length - doc.deletedPages.length : 0;
  // Monta o formulário só com o diálogo aberto: o estado inicial
  // (sugestão de intervalos) é recriado a cada abertura.
  return <SplitForm total={total} />;
}

function SplitForm({ total }: { total: number }) {
  const t = useT();
  const splitting = useEditor((s) => s.splitting);
  const closeSplitDialog = useEditor((s) => s.closeSplitDialog);
  const splitAndDownload = useEditor((s) => s.splitAndDownload);
  const [text, setText] = useState(() => defaultRanges(total));
  const [error, setError] = useState<string | null>(null);

  const preview = text.split(/\r?\n/).filter((l) => l.trim()).length;

  const handleSplit = () => {
    const result = parsePageRanges(text, total, t);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    void splitAndDownload(result.ranges);
  };

  return (
    <div className="modal-backdrop" onClick={() => !splitting && closeSplitDialog()}>
      <div
        className="modal-card modal-split"
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="split-title">{t('splitDialogTitle')}</h2>
        <p>
          {t('splitBodyA')}
          <strong>1-3</strong>
          {t('splitBodyB')}
          <strong>4-5</strong>
          {t('splitBodyC')}
        </p>
        <textarea
          className="split-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          disabled={splitting}
          spellCheck={false}
          aria-label={t('rangesLabel')}
        />
        {error ? (
          <p className="split-error">{error}</p>
        ) : (
          <p className="split-hint">
            {total === 1
              ? t('pagesAvailOne', { n: total })
              : t('pagesAvailMany', { n: total })}
            {' · '}
            {preview === 1 ? t('newFilesOne') : t('newFilesMany')}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeSplitDialog}
            disabled={splitting}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSplit}
            disabled={splitting || preview === 0}
          >
            {splitting ? t('splitting') : t('splitDownloadBtn', { n: preview })}
          </button>
        </div>
      </div>
    </div>
  );
}
