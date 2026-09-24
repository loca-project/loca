/** タグの組み立て・検査・絞り込み（要件 3.3・4.2、ADR 0014・0015）。 */

import { MEMO_MAX_LENGTH, TAG_CATEGORIES, TAG_FIELDS } from '@/core/constants/tags';
import type { TagField } from '@/core/constants/tags';
import type { MarkerData, MarkerTags, TagSelection } from '@/core/types';

/** フォームの選択（未選択は空文字）。 */
export type TagInput = Record<TagField, string>;

export const EMPTY_TAG_INPUT: TagInput = { subject: '', mood: '', season: '', timeOfDay: '', style: '' };

const isOption = (field: TagField, value: string): boolean =>
  TAG_CATEGORIES.some((c) => c.field === field && c.options.some((o) => o.key === value));

/** 必須の項目がそろい、どの値も一覧にあるか。 */
export function isValidTagInput(input: Partial<TagInput>): boolean {
  return TAG_CATEGORIES.every((c) => {
    const value = input[c.field] ?? '';
    if (!value) return !c.required;
    return isOption(c.field, value);
  });
}

/** 保存する形にする。未選択の任意項目は持たない（ルールが空文字を拒否するため）。 */
export function toMarkerTags(input: TagInput): MarkerTags {
  const tags: Record<string, string> = {};
  for (const field of TAG_FIELDS) if (input[field]) tags[field] = input[field];
  return tags as unknown as MarkerTags;
}

/** 保存済みのタグをフォームの選択に戻す。 */
export function toTagInput(tags: Partial<MarkerTags> | undefined): TagInput {
  const input = { ...EMPTY_TAG_INPUT };
  for (const field of TAG_FIELDS) input[field] = tags?.[field] ?? '';
  return input;
}

/** 現地メモを保存する形にする。改行は空白にし、前後の空白を落とす。空なら undefined。 */
export function normalizeMemo(text: string | undefined): string | undefined {
  const memo = (text ?? '').replace(/[\r\n]+/g, ' ').trim();
  return memo ? memo : undefined;
}

export function isValidMemo(text: string | undefined): boolean {
  const memo = normalizeMemo(text);
  return memo === undefined || [...memo].length <= MEMO_MAX_LENGTH;
}

/** 絞り込みの条件が 1 つでもあるか（fields を渡すと、その項目だけを見る）。 */
export function hasTagSelection(selection: TagSelection, fields: TagField[] = TAG_FIELDS): boolean {
  return fields.some((field) => (selection[field]?.length ?? 0) > 0);
}

/**
 * 項目の中は OR、項目の間は AND。値が未設定の項目で絞ると当たらない。
 * fields を渡すと、その項目だけを見る（撮影リクエストは季節・時間帯・撮り方だけ）。
 */
export function matchesTagValues(
  own: Partial<Record<TagField, string>> | undefined,
  selection: TagSelection,
  fields: TagField[] = TAG_FIELDS,
): boolean {
  return fields.every((field) => {
    const wanted = selection[field];
    if (!wanted || wanted.length === 0) return true;
    const value = own?.[field];
    return value !== undefined && wanted.includes(value);
  });
}

export function matchesTags(m: MarkerData, selection: TagSelection): boolean {
  return matchesTagValues(m.tags, selection);
}
