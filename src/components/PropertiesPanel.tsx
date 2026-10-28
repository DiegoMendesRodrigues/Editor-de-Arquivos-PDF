/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useMemo, useRef } from 'react';
import { activeDoc, useEditor } from '../state/editorStore';
import type { EditorElement } from '../lib/types';
import type { MessageKey } from '../lib/i18n';
import { useT } from '../lib/useT';
import { readImageFile } from '../lib/imageUtils';
import { TrashIcon } from './icons';

const KIND_LABEL: Record<EditorElement['kind'], MessageKey> = {
  text: 'kindText',
  image: 'kindImage',
  rect: 'kindRect',
  highlight: 'kindHighlight',
  erase: 'kindErase',
};

const toHexColor = (value: string): string => (/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000');

export function PropertiesPanel() {
  const t = useT();
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const d = useEditor(activeDoc);
  const elements = useMemo(() => d?.elements ?? [], [d]);
  const pageIndex = d?.pageIndex ?? 0;
  const selectedId = d?.selectedId ?? null;
  const select = useEditor((s) => s.select);
  const updateElement = useEditor((s) => s.updateElement);
  const removeElement = useEditor((s) => s.removeElement);
  const setNotice = useEditor((s) => s.setNotice);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const pageElements = useMemo(
    () => elements.filter((e) => e.page === pageIndex),
    [elements, pageIndex],
  );

  const elementLabel = (el: EditorElement): string => {
    if (el.kind === 'text') {
      const txt = el.props.text.replace(/\s+/g, ' ').trim();
      return txt ? `“${txt.slice(0, 24)}${txt.length > 24 ? '…' : ''}”` : t('kindText');
    }
    return t(KIND_LABEL[el.kind]);
  };

  const replaceImage = async (file: File | undefined) => {
    if (!file || !selected || selected.kind !== 'image') return;
    try {
      const img = await readImageFile(file);
      updateElement(selected.id, { src: img.src });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const renderContent = () => {
    if (!selected) {
      return (
        <div className="panel-empty">
          <p className="panel-empty-title">{t('nothingSelected')}</p>
          <p>
            {t('useToolsBefore')}
            <b>{t('toolSelect')}</b>
            {t('useToolsAfter')}
          </p>
        </div>
      );
    }

    const actions = (
      <div className="panel-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => useEditor.getState().duplicateSelected()}
        >
          {t('duplicate')}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => removeElement(selected.id)}>
          <TrashIcon width={15} height={15} />
          {t('delete')}
        </button>
      </div>
    );

    switch (selected.kind) {
      case 'text':
        return (
          <div className="panel-section">
            <h3>{t('kindText')}</h3>
            <label className="field">
              <span>{t('content')}</span>
              <textarea
                rows={4}
                value={selected.props.text}
                onChange={(e) =>
                  updateElement(
                    selected.id,
                    { props: { ...selected.props, text: e.target.value } },
                    { coalesce: `pt-${selected.id}` },
                  )
                }
              />
            </label>
            <div className="field-row">
              <label className="field field-small">
                <span>{t('size')}</span>
                <input
                  type="number"
                  min={4}
                  max={400}
                  step={0.5}
                  value={selected.props.fontSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 4) {
                      updateElement(
                        selected.id,
                        { props: { ...selected.props, fontSize: v } },
                        { coalesce: `ps-${selected.id}` },
                      );
                    }
                  }}
                />
              </label>
              <label className="field field-small">
                <span>{t('color')}</span>
                <input
                  type="color"
                  value={toHexColor(selected.props.color)}
                  onChange={(e) =>
                    updateElement(
                      selected.id,
                      { props: { ...selected.props, color: e.target.value } },
                      { coalesce: `pc-${selected.id}` },
                    )
                  }
                />
              </label>
            </div>
            <div className="field">
              <span>{t('weight')}</span>
              <div className="segmented">
                <button
                  type="button"
                  className={!selected.props.bold ? 'active' : ''}
                  onClick={() =>
                    updateElement(selected.id, { props: { ...selected.props, bold: false } })
                  }
                >
                  {t('normal')}
                </button>
                <button
                  type="button"
                  className={selected.props.bold ? 'active' : ''}
                  onClick={() =>
                    updateElement(selected.id, { props: { ...selected.props, bold: true } })
                  }
                >
                  {t('boldWord')}
                </button>
              </div>
            </div>
            {selected.cover && <p className="hint">{t('coverHint')}</p>}
            {actions}
          </div>
        );

      case 'image':
        return (
          <div className="panel-section">
            <h3>{t('kindImage')}</h3>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => imageInputRef.current?.click()}
            >
              {t('replaceImage')}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              hidden
              onChange={(e) => {
                void replaceImage(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <label className="field">
              <span>{t('opacity', { n: Math.round(selected.opacity * 100) })}</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={selected.opacity}
                onChange={(e) =>
                  updateElement(
                    selected.id,
                    { opacity: Number(e.target.value) },
                    { coalesce: `po-${selected.id}` },
                  )
                }
              />
            </label>
            {actions}
          </div>
        );

      case 'rect':
        return (
          <div className="panel-section">
            <h3>{t('kindRect')}</h3>
            <label className="field field-check">
              <input
                type="checkbox"
                checked={selected.fill !== 'transparent'}
                onChange={(e) =>
                  updateElement(selected.id, {
                    fill: e.target.checked ? '#ffffff' : 'transparent',
                  })
                }
              />
              <span>{t('fill')}</span>
            </label>
            <label className="field">
              <span>{t('fillColor')}</span>
              <input
                type="color"
                disabled={selected.fill === 'transparent'}
                value={toHexColor(selected.fill)}
                onChange={(e) =>
                  updateElement(selected.id, { fill: e.target.value }, { coalesce: `rf-${selected.id}` })
                }
              />
            </label>
            <label className="field">
              <span>{t('strokeColor')}</span>
              <input
                type="color"
                value={toHexColor(selected.stroke)}
                onChange={(e) =>
                  updateElement(selected.id, { stroke: e.target.value }, { coalesce: `rs-${selected.id}` })
                }
              />
            </label>
            <label className="field field-small">
              <span>{t('strokeWidth')}</span>
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                value={selected.strokeWidth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0) {
                    updateElement(
                      selected.id,
                      { strokeWidth: v },
                      { coalesce: `rw-${selected.id}` },
                    );
                  }
                }}
              />
            </label>
            <label className="field">
              <span>{t('opacity', { n: Math.round(selected.opacity * 100) })}</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={selected.opacity}
                onChange={(e) =>
                  updateElement(
                    selected.id,
                    { opacity: Number(e.target.value) },
                    { coalesce: `ro-${selected.id}` },
                  )
                }
              />
            </label>
            {actions}
          </div>
        );

      case 'highlight':
        return (
          <div className="panel-section">
            <h3>{t('kindHighlight')}</h3>
            <label className="field">
              <span>{t('color')}</span>
              <input
                type="color"
                value={toHexColor(selected.color)}
                onChange={(e) =>
                  updateElement(selected.id, { color: e.target.value }, { coalesce: `hc-${selected.id}` })
                }
              />
            </label>
            <label className="field">
              <span>{t('intensity', { n: Math.round(selected.opacity * 100) })}</span>
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.05}
                value={selected.opacity}
                onChange={(e) =>
                  updateElement(
                    selected.id,
                    { opacity: Number(e.target.value) },
                    { coalesce: `ho-${selected.id}` },
                  )
                }
              />
            </label>
            {actions}
          </div>
        );

      case 'erase':
        return (
          <div className="panel-section">
            <h3>{t('kindErase')}</h3>
            <label className="field">
              <span>{t('bgColor')}</span>
              <input
                type="color"
                value={toHexColor(selected.color)}
                onChange={(e) =>
                  updateElement(selected.id, { color: e.target.value }, { coalesce: `ec-${selected.id}` })
                }
              />
            </label>
            <p className="hint">{t('eraseHint')}</p>
            {actions}
          </div>
        );
    }
  };

  return (
    <aside className="panel">
      <div className="panel-scroll">
        <section className="panel-block">{renderContent()}</section>

        <section className="panel-block">
          <h3>{t('pageElements')}</h3>
          {pageElements.length === 0 ? (
            <p className="muted">{t('noChangesPage')}</p>
          ) : (
            <ul className="layer-list">
              {pageElements.map((el) => (
                <li key={el.id} className={el.id === selectedId ? 'active' : ''}>
                  <button type="button" className="layer-btn" onClick={() => select(el.id)}>
                    <span className={`dot dot-${el.kind}`} />
                    <span className="layer-name">{elementLabel(el)}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('delete')}
                    onClick={() => removeElement(el.id)}
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-block">
          <h3>{t('tipsTitle')}</h3>
          <ul className="tips">
            <li>
              <b>V</b> {t('toolSelect')} · <b>T</b> {t('toolText')} · <b>I</b> {t('toolImage')}
            </li>
            <li>
              <b>R</b> {t('toolRect')} · <b>H</b> {t('toolHighlight')} · <b>E</b> {t('toolEraser')}
            </li>
            <li>
              <b>Ctrl+Z</b> {t('undo')} · <b>Delete</b> {t('delete')}
            </li>
          </ul>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => setTool(tool === 'select' ? 'text' : 'select')}
          >
            {t('switchTool')}
          </button>
        </section>
      </div>
    </aside>
  );
}
