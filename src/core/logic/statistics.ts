/** 統計集計（管理者モードの統計タブ / 要件 5.2.1）。markers.json だけで完結する。 */

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
  action: CountRow[];
  atmosphere: CountRow[];
  emotion: CountRow[];
  manufacturer: CountRow[];
  series: CountRow[];
  model: CountRow[];
  prefecture: CountRow[];
  channel: CountRow[];
}

export function computeStatistics(markers: MarkerData[]): MarkerStatistics {
  return {
    total: markers.length,
    action: tally(markers.map((m) => m.tags?.action)),
    atmosphere: tally(markers.map((m) => m.tags?.atmosphere)),
    emotion: tally(markers.map((m) => m.tags?.emotion)),
    manufacturer: tally(markers.map((m) => m.equipment?.manufacturer)),
    series: tally(markers.map((m) => m.equipment?.series)),
    model: tally(markers.map((m) => m.equipment?.model)),
    prefecture: tally(markers.map((m) => m.prefecture)),
    channel: tally(markers.map((m) => m.channelTitle)),
  };
}
