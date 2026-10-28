/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useT } from '../lib/useT';
import { DocIcon, OpenIcon } from './icons';

interface Props {
  onOpenClick: () => void;
}

export function EmptyState({ onOpenClick }: Props) {
  const t = useT();
  return (
    <div className="empty-state">
      <div
        className="drop-card"
        role="button"
        tabIndex={0}
        onClick={onOpenClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenClick();
        }}
      >
        <div className="drop-icon">
          <DocIcon width={48} height={48} />
        </div>
        <h2>{t('emptyTitle')}</h2>
        <p>{t('emptySub')}</p>
        <span className="btn btn-primary">
          <OpenIcon width={16} height={16} />
          {t('selectFileBtn')}
        </span>
        <small>{t('emptyNote')}</small>
      </div>
    </div>
  );
}
