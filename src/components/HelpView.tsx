/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useT } from '../lib/useT';

export function HelpView() {
  const t = useT();
  return (
    <main className="help-view">
      <div className="help-inner">
        <h1 className="help-title">{t('helpAreaTitle')}</h1>
        <section className="help-card">
          <h2 className="help-card-title">{t('helpInfoTitle')}</h2>
          <div className="help-card-body">
            <p>
              {t('helpP1Before')}
              <strong>{t('appFullName')}</strong>
              {t('helpP1Mid')}
              <strong>{t('helpP1AI')}</strong>
              {t('helpP1After')}
            </p>
            <p>{t('helpP2')}</p>
            <p>
              {t('helpP3Before')}
              <strong>{t('appFullName')}</strong>
              {t('helpP3After')}
            </p>
          </div>
        </section>
        <section className="help-card">
          <h2 className="help-card-title">{t('help')}</h2>
          <div className="help-card-body">
            <p>
              {t('helpVideoBefore')}
              <strong>{t('appFullName')}</strong>
              {t('helpVideoAfter')}
            </p>
            <div className="help-video">
              <iframe
                src="https://www.youtube.com/embed/9JdHEaMH6Bo?vq=hd1080&cc_load_policy=0"
                title={t('helpVideoEmbedTitle')}
                width={1920}
                height={1080}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </section>
        <p className="help-blank">{t('helpBlankLine')}</p>
      </div>
    </main>
  );
}
