/** 統計集計（管理者モードの統計タブ / 要件 5.2.1）。markers.json だけで完結する。 */

import type { TagField } from '@/core/constants/tags';
import { TAG_FIELDS } from '@/core/constants/tags';
import type { MarkerData } from '@/core/types';

export interface CountRow {
  label: string;
  count: number;
}

/** Loca への登録日が指定期間に入るマーカーだけを抜き出す。境界は両端含む。 */
export function withinRegisteredRange(
  markers: MarkerData[],
  fromISO?: string,
  toISO?: string,
): MarkerData[] {
  const from = fromISO ? Date.parse(fromISO) : Number.NEGATIVE_INFINITY;
  const to = toISO ? Date.parse(toISO) + 86_399_999 : Number.POSITIVE_INFINITY;
  return markers.filter((m) => !m.deleted && m.createdAt >= from && m.createdAt <= to);
}

function tally(values: (string | undefined)[]): CountRow[] {
  const map = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export interface MarkerStatistics {
  total: number;
  /** タグの項目ごとの件数。label はタグのキー（表示は画面が訳す） */
  tags: Record<TagField, CountRow[]>;
  /** 機器の分類。label は分類のキー（表示は画面が訳す） */
  equipmentCategory: CountRow[];
  manufacturer: CountRow[];
  series: CountRow[];
  model: CountRow[];
  prefecture: CountRow[];
  channel: CountRow[];
}

export function computeStatistics(markers: MarkerData[]): MarkerStatistics {
  return {
    total: markers.length,
    tags: Object.fromEntries(
      TAG_FIELDS.map((field) => [field, tally(markers.map((m) => m.tags?.[field]))]),
    ) as Record<TagField, CountRow[]>,
    equipmentCategory: tally(markers.map((m) => m.equipment?.category)),
    manufacturer: tally(markers.map((m) => m.equipment?.manufacturer)),
    series: tally(markers.map((m) => m.equipment?.series)),
    model: tally(markers.map((m) => m.equipment?.model)),
    prefecture: tally(markers.map((m) => m.prefecture)),
    channel: tally(markers.map((m) => m.channelTitle)),
  };
}
