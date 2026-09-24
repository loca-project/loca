/**
 * 地図フィルタと選択中のマーカーを URL のクエリに載せる（T42）。
 * 共有した URL を開いた人に、同じ絞り込みと同じマーカーを見せるため。
 *
 * 形: ?subject=a,b&mood=c&season=…&timeOfDay=…&style=…&eq=drone&videos=0&requests=0&m=<マーカー ID>
 * 既定値（すべて表示・絞り込みなし）の項目は載せない。知らないキーは読み飛ばす（古い URL や手で書いた URL で落とさない）。
 */

import { EQUIPMENT_CATEGORY_KEYS } from '@/core/constants/equipment';
import { TAG_CATEGORIES } from '@/core/constants/tags';
import type { MapFilter, TagSelection } from '@/core/types';

export interface SharedView {
  filter: MapFilter;
  /** 開いておくマーカーの ID。無ければ null */
  markerId: string | null;
}

/** マーカー ID に使われうる文字だけを通す（Firestore の自動 ID とサンプルの ID） */
const MARKER_ID = /^[A-Za-z0-9_-]{1,64}$/;

function pickKnown(raw: string | null, known: readonly string[]): string[] {
  if (!raw) return [];
  const values = raw.split(',').filter((v) => known.includes(v));
  return [...new Set(values)];
}

/** クエリ文字列（先頭の ? はあってもなくてもよい）から、共有された状態を読む。 */
export function decodeSharedView(search: string): SharedView {
  const params = new URLSearchParams(search);
  const tags: TagSelection = {};
  for (const category of TAG_CATEGORIES) {
    const keys = pickKnown(params.get(category.field), category.options.map((o) => o.key));
    if (keys.length > 0) tags[category.field] = keys;
  }
  const markerId = params.get('m');
  return {
    filter: {
      videos: params.get('videos') !== '0',
      requests: params.get('requests') !== '0',
      tags,
      equipmentCategories: pickKnown(params.get('eq'), EQUIPMENT_CATEGORY_KEYS),
    },
    markerId: markerId && MARKER_ID.test(markerId) ? markerId : null,
  };
}

/**
 * 共有する状態をクエリ文字列にする（先頭の ? を含む。載せるものが無ければ空文字）。
 * 同じ URL の他のクエリ（keep）は残し、このモジュールが扱うキーだけを書き換える。
 */
export function encodeSharedView(view: SharedView, keep = ''): string {
  const params = new URLSearchParams(keep);
  for (const key of SHARED_KEYS) params.delete(key);
  for (const category of TAG_CATEGORIES) {
    const keys = view.filter.tags[category.field] ?? [];
    if (keys.length > 0) params.set(category.field, keys.join(','));
  }
  if (view.filter.equipmentCategories.length > 0) params.set('eq', view.filter.equipmentCategories.join(','));
  if (!view.filter.videos) params.set('videos', '0');
  if (!view.filter.requests) params.set('requests', '0');
  if (view.markerId) params.set('m', view.markerId);
  const query = params.toString().replace(/%2C/g, ',');
  return query ? `?${query}` : '';
}

/** このモジュールが読み書きするクエリのキー */
export const SHARED_KEYS: readonly string[] = [
  ...TAG_CATEGORIES.map((c) => c.field),
  'eq',
  'videos',
  'requests',
  'm',
];
