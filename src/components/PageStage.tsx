/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { activeDoc, useEditor } from '../state/editorStore';
import type { EditorElement, ImageRegionInfo, PageInfo, Rect, TextItemInfo } from '../lib/types';
import { extractImageRegions, extractTextItems } from '../lib/pdfSource';
import { sampleRegionColors } from '../lib/colorSampler';
import { cropCanvasRegion } from '../lib/imageUtils';
import { MIN_DRAG, normRect, uid } from '../lib/geometry';
import { baselineTopOffset, fontFamilyCss, LINE_HEIGHT } from '../lib/textMetrics';
import { useT } from '../lib/useT';
import { ElementNode } from './ElementNode';
import { TextItemLayer } from './TextItemLayer';
import type { ImageTarget } from '../state/editorStore';

interface Props {
  info: PageInfo;
}

interface Draft {
  item: TextItemInfo;
  value: string;
  colors: { bg: string; fg: string };
}

const EMPTY_ELEMENTS: EditorElement[] = [];

export function PageStage({ info }: Props) {
  const t = useT();
  const d = useEditor(activeDoc);
  const doc = d?.doc ?? null;
  const zoom = d?.zoom ?? 1;
  const tool = useEditor((s) => s.tool);
  const elements = d?.elements ?? EMPTY_ELEMENTS;
  const selectedId = d?.selectedId ?? null;
  const editingId = d?.editingId ?? null;
  const select = useEditor((s) => s.select);
  const addElement = useEditor((s) => s.addElement);
  const updateElement = useEditor((s) => s.updateElement);
  const beginTextEdit = useEditor((s) => s.beginTextEdit);
  const endTextEdit = useEditor((s) => s.endTextEdit);
  const placeImage = useEditor((s) => s.placeImage);
  const materializeImageRegion = useEditor((s) => s.materializeImageRegion);
  const setNotice = useEditor((s) => s.setNotice);

  const pageElements = useMemo(
    () => elements.filter((e) => e.page === info.index),
    [elements, info.index],
  );

  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingImageRef = useRef<ImageTarget | null>(null);

  const [visible, setVisible] = useState(false);
  const [renderedZoom, setRenderedZoom] = useState<number | null>(null);
  const [textItems, setTextItems] = useState<TextItemInfo[]>([]);
  const [imageRegions, setImageRegions] = useState<ImageRegionInfo[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ghost, setGhost] = useState<Rect | null>(null);

  useEffect(() => {
    const node = pageRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin: '300px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!doc) return;
    let dead = false;
    extractTextItems(doc, info.index)
      .then((items) => {
        if (!dead) setTextItems(items);
      })
      .catch((err) => console.error(err));
    return () => {
      dead = true;
    };
  }, [doc, info.index]);

  useEffect(() => {
    if (!doc) return;
    let dead = false;
    extractImageRegions(doc, info.index)
      .then((regions) => {
        if (!dead) setImageRegions(regions);
      })
      .catch((err) => console.error(err));
    return () => {
      dead = true;
    };
  }, [doc, info.index]);

  useEffect(() => {
    if (!doc || !visible || renderedZoom === zoom) return;
    let cancelled = false;
    let task: { promise: Promise<void>; cancel: () => void } | null = null;
    (async () => {
      try {
        const page = await doc.getPage(info.index + 1);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: zoom * dpr });
        canvas.width = Math.max(1, Math.floor(vp.width));
        canvas.height = Math.max(1, Math.floor(vp.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        task = page.render({ canvas, viewport: vp }) as unknown as {
          promise: Promise<void>;
          cancel: () => void;
        };
        await task.promise;
        if (!cancelled) setRenderedZoom(zoom);
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (!cancelled && name !== 'RenderingCancelledException') console.error(err);
      }
    })();
    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        // tarefa já finalizada
      }
    };
  }, [doc, info.index, zoom, visible, renderedZoom]);

  const sampleScale = (): number => {
    const canvas = canvasRef.current;
    if (!canvas) return zoom * Math.min(window.devicePixelRatio || 1, 2);
    return canvas.width / Math.max(1, info.width * zoom);
  };

  const startDraft = (item: TextItemInfo) => {
    if (editingId) endTextEdit();
    const canvas = canvasRef.current;
    const colors = canvas
      ? sampleRegionColors(canvas, item.rect, sampleScale())
      : { bg: '#ffffff', fg: '#000000' };
    setDraft({ item, value: item.str, colors });
  };

  const commitDraft = () => {
    if (!draft) return;
    const d = draft;
    setDraft(null);
    if (d.value !== d.item.str && d.value.trim() !== '') {
      addElement({
        id: uid(),
        page: info.index,
        kind: 'text',
        rect: { ...d.item.rect },
        origin: { ...d.item.origin },
        props: {
          text: d.value,
          fontSize: d.item.fontSize,
          color: d.colors.fg,
          bold: false,
        },
        wrap: false,
        cover: d.colors.bg,
      });
    }
  };

  const onImageRegionClick = (region: ImageRegionInfo) => {
    if (editingId) endTextEdit();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bg = sampleRegionColors(canvas, region.rect, sampleScale()).bg;
    const src = cropCanvasRegion(canvas, region.rect, info.width);
    if (!src) {
      setNotice(t('extractImageErr'));
      return;
    }
    materializeImageRegion(info.index, region.rect, src, bg);
  };

  const addTextAt = (x: number, y: number) => {
    const fontSize = 16;
    const id = uid();
    addElement({
      id,
      page: info.index,
      kind: 'text',
      rect: { x, y, w: 240, h: fontSize * LINE_HEIGHT },
      origin: { x, y: y + baselineTopOffset(fontSize) },
      props: { text: 'Novo texto', fontSize, color: '#111827', bold: false },
      wrap: true,
    });
    beginTextEdit(id, { skipHistory: true });
  };

  const pointInPage = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  const onSurfacePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (editingId) endTextEdit();
    dragStartRef.current = pointInPage(e);
    setGhost(null);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSurfacePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const p = pointInPage(e);
    const r = normRect(start.x, start.y, p.x, p.y);
    if (r.w > 2 || r.h > 2) setGhost(r);
  };

  const onSurfacePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setGhost(null);
    if (!start) return;
    const p = pointInPage(e);
    const r = normRect(start.x, start.y, p.x, p.y);
    const isRegion = r.w >= MIN_DRAG && r.h >= MIN_DRAG;

    switch (tool) {
      case 'text': {
        if (!isRegion) addTextAt(start.x, start.y);
        break;
      }
      case 'image': {
        pendingImageRef.current = isRegion
          ? { mode: 'region', pageIndex: info.index, rect: r }
          : { mode: 'point', pageIndex: info.index, x: start.x, y: start.y };
        fileRef.current?.click();
        break;
      }
      case 'rect': {
        if (!isRegion) break;
        addElement({
          id: uid(),
          page: info.index,
          kind: 'rect',
          rect: r,
          fill: 'transparent',
          stroke: '#111827',
          strokeWidth: 1.5,
          opacity: 1,
        });
        break;
      }
      case 'highlight': {
        if (!isRegion) break;
        addElement({
          id: uid(),
          page: info.index,
          kind: 'highlight',
          rect: r,
          color: '#fde047',
          opacity: 0.45,
        });
        break;
      }
      case 'eraser': {
        if (!isRegion) break;
        const canvas = canvasRef.current;
        const color = canvas
          ? sampleRegionColors(canvas, r, sampleScale()).bg
          : '#ffffff';
        addElement({ id: uid(), page: info.index, kind: 'erase', rect: r, color });
        break;
      }
      default:
        break;
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = pendingImageRef.current;
    pendingImageRef.current = null;
    if (file && target) void placeImage(file, target);
  };

  const editingElement = editingId
    ? pageElements.find((e) => e.id === editingId)
    : null;
  const editingText =
    editingElement && editingElement.kind === 'text' ? editingElement : null;

  const ghostStyle: CSSProperties | undefined = ghost
    ? {
        left: ghost.x * zoom,
        top: ghost.y * zoom,
        width: ghost.w * zoom,
        height: ghost.h * zoom,
        background:
          tool === 'highlight'
            ? 'rgba(253, 224, 71, 0.35)'
            : tool === 'eraser'
              ? 'rgba(255, 255, 255, 0.75)'
              : tool === 'rect'
                ? 'rgba(17, 24, 39, 0.08)'
                : 'rgba(37, 99, 235, 0.08)',
      }
    : undefined;

  return (
    <div
      ref={pageRef}
      className="page"
      data-page={info.index}
      style={{ width: info.width * zoom, height: info.height * zoom }}
      onPointerDown={() => {
        if (tool === 'select' && !editingId) select(null);
      }}
    >
      <canvas ref={canvasRef} className="page-canvas" />

      <TextItemLayer
        items={textItems}
        zoom={zoom}
        enabled={tool === 'select' && !editingId}
        onEdit={startDraft}
      />

      <div className="img-layer">
        {tool === 'select' &&
          !editingId &&
          imageRegions.map((r) => (
            <div
              key={r.key}
              className="img-hit"
              title={t('editThisImage')}
              style={{
                left: r.rect.x * zoom,
                top: r.rect.y * zoom,
                width: r.rect.w * zoom,
                height: r.rect.h * zoom,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onImageRegionClick(r);
              }}
            />
          ))}
      </div>

      <div className="elements-layer">
        {pageElements.map((el) => (
          <ElementNode
            key={el.id}
            el={el}
            zoom={zoom}
            pageW={info.width}
            pageH={info.height}
            selected={el.id === selectedId}
            tool={tool}
          />
        ))}
      </div>

      {ghost && tool !== 'text' && tool !== 'image' && (
        <div className="ghost" style={ghostStyle} />
      )}

      {tool !== 'select' && (
        <div
          className="draw-surface"
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
          onPointerCancel={onSurfacePointerUp}
        />
      )}

      {draft && (
        <textarea
          className="inline-editor draft-editor"
          autoFocus
          value={draft.value}
          spellCheck={false}
          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          onBlur={commitDraft}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(null);
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitDraft();
            }
          }}
          style={{
            left: draft.item.rect.x * zoom,
            top: draft.item.rect.y * zoom,
            width: Math.max(draft.item.rect.w, 40) * zoom,
            minHeight: draft.item.rect.h * zoom,
            fontSize: draft.item.fontSize * zoom,
            lineHeight: `${draft.item.fontSize * LINE_HEIGHT * zoom}px`,
            color: draft.colors.fg,
            background: draft.colors.bg,
            fontFamily: fontFamilyCss(),
          }}
        />
      )}

      {editingText && (
        <textarea
          className="inline-editor"
          autoFocus
          value={editingText.props.text}
          spellCheck={false}
          onChange={(e) =>
            updateElement(
              editingText.id,
              { props: { ...editingText.props, text: e.target.value } },
              { coalesce: `text-${editingText.id}` },
            )
          }
          onBlur={endTextEdit}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          style={{
            left: editingText.origin.x * zoom,
            top:
              (editingText.origin.y -
                baselineTopOffset(editingText.props.fontSize)) *
              zoom,
            width: editingText.wrap
              ? (editingText.rect.x + editingText.rect.w - editingText.origin.x) *
                zoom
              : Math.max(
                  editingText.rect.x + editingText.rect.w - editingText.origin.x,
                  160,
                ) * zoom,
            fontSize: editingText.props.fontSize * zoom,
            lineHeight: `${editingText.props.fontSize * LINE_HEIGHT * zoom}px`,
            color: editingText.props.color,
            fontWeight: editingText.props.bold ? 700 : 400,
            background: editingText.cover ?? 'transparent',
            fontFamily: fontFamilyCss(),
          }}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        hidden
        onChange={onFileChange}
      />
    </div>
  );
}
