/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TextItemInfo } from '../lib/types';
import { useT } from '../lib/useT';

interface Props {
  items: TextItemInfo[];
  zoom: number;
  enabled: boolean;
  onEdit: (item: TextItemInfo) => void;
}

export function TextItemLayer({ items, zoom, enabled, onEdit }: Props) {
  const t = useT();
  const [hover, setHover] = useState<string | null>(null);
  if (!enabled) return null;

  return (
    <div className="text-layer">
      {items.map((it) => (
        <div
          key={it.key}
          className={`text-hit${hover === it.key ? ' hover' : ''}`}
          style={{
            left: it.rect.x * zoom,
            top: it.rect.y * zoom,
            width: it.rect.w * zoom,
            height: it.rect.h * zoom,
          }}
          title={t('editThisText')}
          onMouseEnter={() => setHover(it.key)}
          onMouseLeave={() => setHover((h) => (h === it.key ? null : h))}
          onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(it);
          }}
        />
      ))}
    </div>
  );
}
