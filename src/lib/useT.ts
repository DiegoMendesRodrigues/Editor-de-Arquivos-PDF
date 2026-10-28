/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
import { useEditor } from '../state/editorStore';
import { translate, type TFunction } from './i18n';

/** Hook de tradução: re-renderiza quando o idioma muda. */
export const useT = (): TFunction => {
  const locale = useEditor((s) => s.locale);
  return (key, vars) => translate(locale, key, vars);
};
