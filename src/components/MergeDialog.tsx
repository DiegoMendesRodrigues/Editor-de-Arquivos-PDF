/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useEditor } from '../state/editorStore';
import { useT } from '../lib/useT';

export function MergeDialog() {
  const t = useT();
  const open = useEditor((s) => s.mergeOpen);
  const docs = useEditor((s) => s.docs);
  const mergeIds = useEditor((s) => s.mergeIds);
  const merging = useEditor((s) => s.merging);
  const closeMergeDialog = useEditor((s) => s.closeMergeDialog);
  const toggleMergeId = useEditor((s) => s.toggleMergeId);
  const mergeAndDownload = useEditor((s) => s.mergeAndDownload);

  if (!open) return null;

  const ready = docs.filter((d) => d.status === 'ready');
  const selectedCount = mergeIds.filter((id) => ready.some((d) => d.id === id)).length;
  const canMerge = selectedCount >= 2 && !merging;

  return (
    <div className="modal-backdrop" onClick={() => !merging && closeMergeDialog()}>
      <div
        className="modal-card modal-merge"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="merge-title">{t('mergeDialogTitle')}</h2>
        <p>{t('mergeDialogBody')}</p>
        <ul className="merge-list">
          {ready.map((d, i) => {
            const checked = mergeIds.includes(d.id);
            const pages = d.pages.length - d.deletedPages.length;
            return (
              <li key={d.id} className="merge-item">
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={merging}
                    onChange={() => toggleMergeId(d.id)}
                  />
                  <span className="merge-order">{i + 1}.</span>
                  <span className="merge-name" title={d.fileName}>
                    {d.fileName}
                  </span>
                  <span className="merge-meta">
                    {pages === 1 ? t('pagesOne', { n: pages }) : t('pagesMany', { n: pages })}
                    {d.elements.length > 0 &&
                      ` · ${
                        d.elements.length === 1
                          ? t('changesOne', { n: d.elements.length })
                          : t('changesMany', { n: d.elements.length })
                      }`}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeMergeDialog}
            disabled={merging}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void mergeAndDownload()}
            disabled={!canMerge}
          >
            {merging ? t('merging') : t('mergeAndDownload', { n: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
