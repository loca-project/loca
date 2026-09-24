/** 画面下の地図フィルタ（ADR 0015）。地図に出すマーカーを絞る。 */

import { TAG_FIELDS } from '@/core/constants/tags';
import type { MapFilter, MarkerData, RequestMarkerData } from '@/core/types';
import { narrowRequestSpots } from './requests';
import { matchesTags } from './tags';

export function filterMarkersForMap(markers: MarkerData[], f: MapFilter): MarkerData[] {
  if (!f.videos) return [];
  const cats = f.equipmentCategories;
  return markers.filter(
    (m) => matchesTags(m, f.tags) && (cats.length === 0 || cats.includes(m.equipment?.category ?? '')),
  );
}

/** 撮影リクエストには季節・時間帯・撮り方だけが効く（映っているもの・雰囲気は持たないため）。 */
export function filterRequestsForMap(spots: RequestMarkerData[], f: MapFilter): RequestMarkerData[] {
  if (!f.requests) return [];
  return narrowRequestSpots(spots, f.tags);
}

/** 「フィルター」ボタンに出す、有効な条件の数（選んだタグと機器の分類の数と、隠している種類の数）。 */
export function activeFilterCount(f: MapFilter): number {
  const tags = TAG_FIELDS.reduce((sum, field) => sum + (f.tags[field]?.length ?? 0), 0);
  return tags + f.equipmentCategories.length + (f.videos ? 0 : 1) + (f.requests ? 0 : 1);
}
