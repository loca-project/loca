import type { TagField } from './tags';

/**
 * 撮影リクエストで指定できるタグ（ADR 0014）。語とキーは動画のタグと同じ（tags.ts）。
 * 「どう撮ってほしいか」なので、映っているもの・雰囲気は持たない。
 */
export type RequestTagField = Extract<TagField, 'season' | 'timeOfDay' | 'style'>;
export const REQUEST_TAG_FIELDS: RequestTagField[] = ['season', 'timeOfDay', 'style'];

/** 熱量の選択肢（1〜5）。 */
export const HEAT_LEVELS = [1, 2, 3, 4, 5];
