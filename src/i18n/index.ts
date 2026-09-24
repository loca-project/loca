/**
 * 言語の決定とリソースのマージ。
 * 要件 2.2: 既定は日本語。ブラウザの言語が英語なら英語にする。
 */

import type { LanguageCode } from '@/core/types';
import { ja, type Dictionary } from './ja';
import { en } from './en';

const STORAGE_KEY = 'loca.lang';

function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {
    // localStorage が使えない環境ではブラウザ設定だけで判断する
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'ja';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'ja';
}

/** 未定義キーを日本語で埋めながら深くマージする。 */
function merge<T>(base: T, override: unknown): T {
  if (override == null || typeof override !== 'object') return base;
  const result = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const current = result[key];
    if (current && typeof current === 'object' && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = merge(current, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

const dictionaries: Record<LanguageCode, Dictionary> = {
  ja,
  en: merge(ja, en),
};

let currentLanguage: LanguageCode = detectLanguage();

/** 言語の変更を待つ部品。変えたら全員に知らせ、開いている画面をまとめて描き直させる。 */
const listeners = new Set<() => void>();

export function getLanguage(): LanguageCode {
  return currentLanguage;
}

/** 言語の変更を購読する（useSyncExternalStore 用）。解除する関数を返す。 */
export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLanguage(lang: LanguageCode): void {
  if (lang === currentLanguage) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 保存できなくても当該セッションでは切り替わる
  }
  listeners.forEach((l) => l());
}

export function t(): Dictionary {
  return dictionaries[currentLanguage];
}

export type { Dictionary };
