/** タグをチップの選択肢にする（登録フォーム・ランキング・地図フィルタで共通）。 */

import { MOOD_HEX, TAG_CATEGORIES, type TagCategory, type TagField } from '@/core/constants';
import type { LanguageCode } from '@/core/types';
import type { ChipOption } from '@/shared/components/Controls';

/** 雰囲気にはマーカーと同じ色の印を付ける（凡例を兼ねる。ADR 0015）。 */
export function chipOptions(category: TagCategory, lang: LanguageCode): ChipOption[] {
  return category.options.map((o) => ({
    value: o.key,
    label: lang === 'ja' ? o.ja : o.en,
    color: category.field === 'mood' ? (MOOD_HEX as Record<string, string>)[o.key] : undefined,
  }));
}

export function categoryOf(field: TagField): TagCategory {
  return TAG_CATEGORIES.find((c) => c.field === field) as TagCategory;
}
