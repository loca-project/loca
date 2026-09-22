/** 言語切り替えを React に載せる。 */

import { useCallback, useState } from 'react';
import type { LanguageCode } from '@/core/types';
import { getLanguage, setLanguage, t, type Dictionary } from '@/i18n';

export function useI18n(): {
  t: Dictionary;
  lang: LanguageCode;
  changeLanguage: (lang: LanguageCode) => void;
} {
  const [lang, setLang] = useState<LanguageCode>(getLanguage());

  const changeLanguage = useCallback((next: LanguageCode) => {
    setLanguage(next);
    setLang(next);
  }, []);

  return { t: t(), lang, changeLanguage };
}
