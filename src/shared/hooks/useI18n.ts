/**
 * 言語切り替えを React に載せる。
 * 言語は i18n モジュールの 1 か所で持ち、変わったら使っている部品すべてを描き直す
 * （部品ごとに状態を持つと、切り替えた部品しか変わらない。サイドメニューが古い言語のまま残っていた）。
 */

import { useSyncExternalStore } from 'react';
import type { LanguageCode } from '@/core/types';
import { getLanguage, setLanguage, subscribeLanguage, t, type Dictionary } from '@/i18n';

export function useI18n(): {
  t: Dictionary;
  lang: LanguageCode;
  changeLanguage: (lang: LanguageCode) => void;
} {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage);
  return { t: t(), lang, changeLanguage: setLanguage };
}
