/**
 * 撮影リクエストを地点ごとにまとめる・外す・内訳を出す。
 * まとめ方は scripts/lib/merge-requests.mjs（日次の同期）と同じ。距離のしきい値は両方で揃える。
 */

import { REQUEST_TAG_FIELDS } from '@/core/constants/requestOptions';
import type { RequestEntry, RequestEntrySummary, RequestMarkerData, TagSelection } from '@/core/types';
import type { CountRow } from './statistics';
import { hasTagSelection, matchesTagValues } from './tags';

/** この範囲（度）に収まるリクエストは同じ地点として数える。約 30 m。 */
export const SAME_SPOT_EPS = 0.0003;

const isNear = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < SAME_SPOT_EPS && Math.abs(a.lng - b.lng) < SAME_SPOT_EPS;

const summaryOf = (e: RequestEntry): RequestEntrySummary => ({
  id: e.id,
  heat: e.heat,
  ...(e.season ? { season: e.season } : {}),
  ...(e.timeOfDay ? { timeOfDay: e.timeOfDay } : {}),
  ...(e.style ? { style: e.style } : {}),
  equipment: e.equipment,
  ownerUid: e.ownerUid,
  createdAt: e.createdAt,
});

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
    // 合計と件数は足していく（entries を持たない古い地点でも合計を壊さないため）
    spot.entries.push(summaryOf(entry));
    spot.totalHeat += entry.heat;
    spot.requestCount += 1;
    spot.updatedAt = Math.max(spot.updatedAt, entry.createdAt);
  }
  return next;
}

/** 取り下げたリクエストを外す。リクエストが無くなった地点は消す。 */
export function removeRequestEntries(spots: RequestMarkerData[], ids: string[]): RequestMarkerData[] {
  if (ids.length === 0) return spots;
  const gone = new Set(ids);
  return spots
    .map((s) => {
      const removed = (s.entries ?? []).filter((e) => gone.has(e.id));
      if (removed.length === 0) return s;
      return {
        ...s,
        entries: (s.entries ?? []).filter((e) => !gone.has(e.id)),
        totalHeat: s.totalHeat - removed.reduce((sum, e) => sum + e.heat, 0),
        requestCount: s.requestCount - removed.length,
      };
    })
    .filter((s) => s.requestCount > 0);
}

export interface RequestBreakdown {
  season: CountRow[];
  timeOfDay: CountRow[];
  style: CountRow[];
  equipment: CountRow[];
}

/**
 * 地点の内訳（指摘 8）。季節・時間帯・撮り方・機器ごとに、熱量の合計を多い順に並べる。
 * 「何を撮ればリクエストに応えられるか」を伝えるのが目的なので、件数ではなく熱量で重みを付ける。
 * label はタグのキー（表示は画面が訳す）。
 */
export function requestBreakdown(spot: RequestMarkerData): RequestBreakdown {
  const sum = (pick: (e: RequestEntrySummary) => string | undefined): CountRow[] => {
    const totals = new Map<string, number>();
    for (const e of spot.entries ?? []) {
      const label = pick(e)?.trim();
      if (label) totals.set(label, (totals.get(label) ?? 0) + e.heat);
    }
    return [...totals].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };
  return {
    season: sum((e) => e.season),
    timeOfDay: sum((e) => e.timeOfDay),
    style: sum((e) => e.style),
    equipment: sum((e) => [e.equipment?.manufacturer, e.equipment?.series, e.equipment?.model].filter(Boolean).join(' ')),
  };
}

/**
 * 撮影リクエストのランキング（熱量の多い順）。
 * 季節・時間帯・撮り方で絞ると、条件に合うリクエストの熱量だけで数え直す（項目の中は OR、間は AND）。
 */
export function rankRequestSpots(spots: RequestMarkerData[], selection: TagSelection, limit: number): RequestMarkerData[] {
  const filtered = hasTagSelection(selection, REQUEST_TAG_FIELDS)
    ? spots
        .map((s) => {
          const hit = (s.entries ?? []).filter((e) => matchesTagValues(e, selection, REQUEST_TAG_FIELDS));
          return { ...s, entries: hit, totalHeat: hit.reduce((sum, e) => sum + e.heat, 0), requestCount: hit.length };
        })
        .filter((s) => s.requestCount > 0)
    : spots;
  return [...filtered].sort((a, b) => b.totalHeat - a.totalHeat).slice(0, limit);
}
