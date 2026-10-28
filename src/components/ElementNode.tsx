/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { activeDoc, useEditor } from '../state/editorStore';
import type { EditorElement, Rect, Tool } from '../lib/types';
import { clamp, clampRectToPage } from '../lib/geometry';
import { baselineTopOffset, fontFamilyCss, LINE_HEIGHT } from '../lib/textMetrics';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MIN_SIZE = 10;

interface Props {
  el: EditorElement;
  zoom: number;
  pageW: number;
  pageH: number;
  selected: boolean;
  tool: Tool;
}

interface DragStart {
  x: number;
  y: number;
  rect: Rect;
  handle: Handle | null;
}

export function ElementNode({ el, zoom, pageW, pageH, selected, tool }: Props) {
  const editingId = useEditor((s) => activeDoc(s)?.editingId ?? null);
  const select = useEditor((s) => s.select);
  const pushHistory = useEditor((s) => s.pushHistory);
  const setElementRect = useEditor((s) => s.setElementRect);
  const beginTextEdit = useEditor((s) => s.beginTextEdit);

  const dragRef = useRef<DragStart | null>(null);
  const movedRef = useRef(false);

  const interactive = tool === 'select';
  const editing = editingId === el.id;

  const beginDrag = (e: ReactPointerEvent, handle: Handle | null) => {
    if (!interactive || editing || e.button !== 0) return;
    e.stopPropagation();
    select(el.id);
    dragRef.current = { x: e.clientX, y: e.clientY, rect: { ...el.rect }, handle };
    movedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerDown = (e: ReactPointerEvent) => beginDrag(e, null);

  const onPointerMove = (e: ReactPointerEvent) => {
    const start = dragRef.current;
    if (!start) return;
    const distX = (e.clientX - start.x) / zoom;
    const distY = (e.clientY - start.y) / zoom;
    if (!movedRef.current) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 3) return;
      movedRef.current = true;
      pushHistory();
    }

    if (!start.handle) {
      const rect = clampRectToPage(
        { ...start.rect, x: start.rect.x + distX, y: start.rect.y + distY },
        pageW,
        pageH,
      );
      setElementRect(el.id, rect, { coalesce: `mv-${el.id}` });
      return;
    }

    const o = start.rect;
    const handle = start.handle;
    let x = o.x;
    let y = o.y;
    let w = o.w;
    let h = o.h;

    if (handle.includes('w')) {
      x = clamp(o.x + distX, 0, o.x + o.w - MIN_SIZE);
      w = o.x + o.w - x;
    }
    if (handle.includes('e')) {
      w = clamp(o.w + distX, MIN_SIZE, pageW - o.x);
    }
    if (handle.includes('n')) {
      y = clamp(o.y + distY, 0, o.y + o.h - MIN_SIZE);
      h = o.y + o.h - y;
    }
    if (handle.includes('s')) {
      h = clamp(o.h + distY, MIN_SIZE, pageH - o.y);
    }

    if (el.kind === 'image' && handle.length === 2 && o.h > 0) {
      const ar = o.w / o.h;
      h = Math.max(MIN_SIZE, Math.round(w / ar));
      w = Math.round(h * ar);
      if (handle.includes('n')) y = o.y + o.h - h;
      if (handle.includes('w')) x = o.x + o.w - w;
      x = clamp(x, 0, Math.max(0, pageW - w));
      y = clamp(y, 0, Math.max(0, pageH - h));
      w = Math.min(w, pageW);
      h = Math.min(h, pageH);
    }

    setElementRect(el.id, { x, y, w, h }, { coalesce: `rs-${el.id}` });
  };

  const endDrag = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    movedRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // captura já liberada
    }
  };

  const style: CSSProperties = {
    left: el.rect.x * zoom,
    top: el.rect.y * zoom,
    width: el.rect.w * zoom,
    height: el.rect.h * zoom,
    pointerEvents: interactive ? 'auto' : 'none',
    cursor: interactive ? 'move' : undefined,
    opacity: 1,
  };

  let inner: ReactNode = null;

  switch (el.kind) {
    case 'text': {
      style.background = el.cover ?? 'transparent';
      if (!editing) {
        const fs = el.props.fontSize;
        const left = (el.origin.x - el.rect.x) * zoom;
        const top = (el.origin.y - baselineTopOffset(fs) - el.rect.y) * zoom;
        const width = (el.rect.x + el.rect.w - el.origin.x) * zoom;
        inner = (
          <span
            className="el-text-content"
            style={{
              left,
              top,
              width: el.wrap ? width : undefined,
              fontSize: fs * zoom,
              lineHeight: `${fs * LINE_HEIGHT * zoom}px`,
              color: el.props.color,
              fontWeight: el.props.bold ? 700 : 400,
              fontFamily: fontFamilyCss(),
              whiteSpace: el.wrap ? 'pre-wrap' : 'pre',
            }}
          >
            {el.props.text}
          </span>
        );
      }
      break;
    }
    case 'image': {
      inner = (
        <img
          src={el.src}
          alt="Imagem do PDF"
          draggable={false}
          style={{ width: '100%', height: '100%', display: 'block', opacity: el.opacity }}
        />
      );
      break;
    }
    case 'rect': {
      style.background = el.fill === 'transparent' ? 'transparent' : el.fill;
      style.opacity = el.opacity;
      if (el.strokeWidth > 0 && el.stroke !== 'transparent') {
        style.border = `${el.strokeWidth * zoom}px solid ${el.stroke}`;
      }
      break;
    }
    case 'highlight': {
      style.background = el.color;
      style.opacity = el.opacity;
      break;
    }
    case 'erase': {
      style.background = el.color;
      break;
    }
  }

  const showHandles = selected && interactive && !editing;

  return (
    <div
      className={`el el-${el.kind}${selected && interactive ? ' selected' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        if (interactive && el.kind === 'text' && !editing) beginTextEdit(el.id);
      }}
    >
      {inner}
      {showHandles &&
        HANDLES.map((h) => (
          <span
            key={h}
            className={`handle handle-${h}`}
            onPointerDown={(e) => beginDrag(e, h)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
    </div>
  );
}
