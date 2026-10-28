/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useEffect, useMemo, useRef } from 'react';
import { activeDoc, useEditor, visiblePages } from '../state/editorStore';
import { clamp } from '../lib/geometry';
import { PageStage } from './PageStage';

export function Viewer() {
  const d = useEditor(activeDoc);
  const pages = useMemo(() => visiblePages(d), [d]);
  const pageIndex = d?.pageIndex ?? 0;
  const setPageIndex = useEditor((s) => s.setPageIndex);
  const zoom = d?.zoom ?? 1;
  const setZoom = useEditor((s) => s.setZoom);
  const fitMode = d?.fitMode ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);

  const visiblePage = (): number => {
    const root = scrollRef.current;
    if (!root) return 0;
    const nodes = root.querySelectorAll<HTMLElement>('[data-page]');
    if (!nodes.length) return 0;
    const probe = root.scrollTop + 80;
    let idx = 0;
    nodes.forEach((n) => {
      if (n.offsetTop <= probe) idx = Number(n.dataset.page);
    });
    return idx;
  };

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const update = () => {
      const idx = visiblePage();
      if (idx !== (activeDoc(useEditor.getState())?.pageIndex ?? 0)) setPageIndex(idx);
    };
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [setPageIndex]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || fitMode) return;
    const node = root.querySelector<HTMLElement>(`[data-page="${pageIndex}"]`);
    if (!node) return;
    if (visiblePage() === pageIndex) return;
    root.scrollTo({ top: Math.max(0, node.offsetTop - 24), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pages.length]);

  useEffect(() => {
    if (!fitMode) return;
    const root = scrollRef.current;
    if (!root) return;
    const apply = () => {
      const page = pages.find((p) => p.index === pageIndex);
      if (!page) return;
      const available = root.clientWidth - 48;
      if (available <= 0) return;
      const z = clamp(available / page.width, 0.25, 4);
      if (Math.abs(z - zoom) > 0.005) setZoom(z, { keepFit: true });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(root);
    return () => ro.disconnect();
  }, [fitMode, pageIndex, pages, zoom, setZoom]);

  return (
    <div className="viewer" ref={scrollRef}>
      <div className="viewer-pages">
        {pages.map((p) => (
          <PageStage key={p.index} info={p} />
        ))}
      </div>
    </div>
  );
}
