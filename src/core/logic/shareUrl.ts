/**
 * 地図フィルタと選択中のマーカー・撮影リクエストを URL のクエリに載せる（T42・T84）。
 * 共有した URL を開いた人に、同じ絞り込みと同じマーカー（撮影リクエストの地点）を見せるため。
 *
 * 形: ?subject=a,b&mood=c&season=…&timeOfDay=…&style=…&eq=drone&videos=0&requests=0&m=<マーカー ID>
 *     撮影リクエストは &r=<緯度>,<経度>（小数 6 桁）。地点の ID は同期のたびに変わりうるので、位置で指す
 * 既定値（すべて表示・絞り込みなし）の項目は載せない。知らないキーは読み飛ばす（古い URL や手で書いた URL で落とさない）。
 */

import { EQUIPMENT_CATEGORY_KEYS } from '@/core/constants/equipment';
import { TAG_CATEGORIES } from '@/core/constants/tags';
import type { LatLng, MapFilter, TagSelection } from '@/core/types';

export interface SharedView {
  filter: MapFilter;
  /** 開いておくマーカーの ID。無ければ null */
  markerId: string | null;
  /** 開いておく撮影リクエストの地点の位置（T84）。無ければ null。マーカーと両方あればマーカーを優先する */
  requestAt?: LatLng | null;
}

/** マーカー ID に使われうる文字だけを通す（Firestore の自動 ID とサンプルの ID） */
const MARKER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** r=<緯度>,<経度> を読む。範囲外・数でないものは読み飛ばす */
function parseLatLng(raw: string | null): LatLng | null {
  const m = raw?.match(/^(-?\d{1,3}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

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
    requestAt: parseLatLng(params.get('r')),
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
  else if (view.requestAt) params.set('r', `${view.requestAt.lat.toFixed(6)},${view.requestAt.lng.toFixed(6)}`);
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
  'r',
];
