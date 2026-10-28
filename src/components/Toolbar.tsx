/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { activeDoc, useEditor } from '../state/editorStore';
import type { Tool } from '../lib/types';
import type { MessageKey } from '../lib/i18n';
import { useT } from '../lib/useT';
import {
  CursorIcon,
  EraserIcon,
  HighlightIcon,
  ImageIcon,
  RedoIcon,
  RectIcon,
  TextIcon,
  UndoIcon,
} from './icons';

interface ToolDef {
  id: Tool;
  label: MessageKey;
  hint: MessageKey;
  icon: typeof CursorIcon;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'toolSelect', hint: 'toolSelectHint', icon: CursorIcon },
  { id: 'text', label: 'toolText', hint: 'toolTextHint', icon: TextIcon },
  { id: 'image', label: 'toolImage', hint: 'toolImageHint', icon: ImageIcon },
  { id: 'rect', label: 'toolRect', hint: 'toolRectHint', icon: RectIcon },
  { id: 'highlight', label: 'toolHighlight', hint: 'toolHighlightHint', icon: HighlightIcon },
  { id: 'eraser', label: 'toolEraser', hint: 'toolEraserHint', icon: EraserIcon },
];

export function Toolbar() {
  const t = useT();
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => (activeDoc(s)?.past.length ?? 0) > 0);
  const canRedo = useEditor((s) => (activeDoc(s)?.future.length ?? 0) > 0);

  return (
    <aside className="toolbar">
      <div className="toolbar-group">
        {TOOLS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`tool-btn${tool === item.id ? ' active' : ''}`}
              title={t(item.hint)}
              aria-pressed={tool === item.id}
              onClick={() => setTool(item.id)}
            >
              <Icon width={20} height={20} />
              <span>{t(item.label)}</span>
            </button>
          );
        })}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <button
          type="button"
          className="tool-btn"
          title={t('undoHint')}
          onClick={undo}
          disabled={!canUndo}
        >
          <UndoIcon width={20} height={20} />
          <span>{t('undo')}</span>
        </button>
        <button
          type="button"
          className="tool-btn"
          title={t('redoHint')}
          onClick={redo}
          disabled={!canRedo}
        >
          <RedoIcon width={20} height={20} />
          <span>{t('redo')}</span>
        </button>
      </div>
    </aside>
  );
}
