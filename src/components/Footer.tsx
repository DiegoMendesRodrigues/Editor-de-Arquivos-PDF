/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useEffect, useRef, useState } from 'react';
import { LOCALE_OPTIONS, type Locale } from '../lib/i18n';
import { useT } from '../lib/useT';
import { useEditor } from '../state/editorStore';
import { GlobeIcon, HelpIcon } from './icons';

export function Footer() {
  const t = useT();
  const locale = useEditor((s) => s.locale);
  const setLocale = useEditor((s) => s.setLocale);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de idioma ao clicar fora ou pressionar Esc.
  useEffect(() => {
    if (!langOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [langOpen]);

  const chooseLocale = (next: Locale) => {
    setLangOpen(false);
    setLocale(next);
  };

  const langLabel = LOCALE_OPTIONS.find((o) => o.value === locale)?.label ?? '';

  return (
    <footer className="app-footer">
      <span className="app-footer-brand">{t('footerBrand')}</span>
      <div className="app-footer-actions">
        <button
          type="button"
          className="footer-btn"
          onClick={() => useEditor.getState().toggleHelp()}
          title={t('help')}
        >
          <HelpIcon width={16} height={16} />
          {t('help')}
        </button>
        <div className="lang-group" ref={langRef}>
          <button
            type="button"
            className="footer-btn"
            onClick={() => setLangOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={langOpen}
            title={t('langTooltip')}
          >
            <GlobeIcon width={16} height={16} />
            {langLabel}
          </button>
          {langOpen && (
            <div className="popup-menu lang-menu" role="menu">
              {LOCALE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={o.value === locale}
                  className={`popup-menu-item${o.value === locale ? ' active' : ''}`}
                  onClick={() => chooseLocale(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
