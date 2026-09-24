/**
 * 撮影リクエストを地点ごとにまとめる。
 * 同じ扱いを scripts/lib/merge-requests.mjs（日次の同期）でも行う。距離のしきい値は両方で揃える。
 */

import type { RequestEntry, RequestMarkerData } from '@/core/types';

/** この範囲（度）に収まるリクエストは同じ地点として数える。約 30 m。 */
export const SAME_SPOT_EPS = 0.0003;

const isNear = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < SAME_SPOT_EPS && Math.abs(a.lng - b.lng) < SAME_SPOT_EPS;

/**
 * 地点の一覧に、新しく届いたリクエストを足す。
 * すでに集計に含まれている ID は数えない（requests.json と購読の両方に同じ行が来るため）。
 * 近くに地点が無ければ、そのリクエストの位置に新しい地点を作る。
 */
export function mergeRequestEntries(spots: RequestMarkerData[], entries: RequestEntry[]): RequestMarkerData[] {
  const next = spots.map((s) => ({ ...s, entries: [...(s.entries ?? [])] }));
  const counted = new Set(next.flatMap((s) => s.entries.map((e) => e.id)));

  for (const entry of entries) {
    if (counted.has(entry.id)) continue;
    counted.add(entry.id);
    let spot = next.find((s) => isNear(s, entry));
    if (!spot) {
      spot = { id: `rq_${entry.id}`, lat: entry.lat, lng: entry.lng, totalHeat: 0, requestCount: 0, updatedAt: 0, entries: [] };
      next.push(spot);
    }
    spot.entries.push({ id: entry.id, heat: entry.heat });
    spot.totalHeat += entry.heat;
    spot.requestCount += 1;
    spot.updatedAt = Math.max(spot.updatedAt, entry.createdAt);
  }
  return next;
}
