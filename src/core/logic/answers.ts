/**
 * 撮影リクエストへの回答（T43・ADR 0028）。
 * 応える側: 地点のリクエストのうち、どれに応えるか。受け取る側: 自分のリクエストに届いた動画はどれか。
 * どちらも地図の一覧（公開データ＋差分の購読）だけから出す。Firestore の読み取りは増やさない。
 */

import type { MarkerData, RequestEntrySummary, RequestMarkerData } from '@/core/types';

/** マーカーに付けられる回答の数の上限（ルールの validAnswers と同じ） */
export const MAX_ANSWERS = 10;
/** 応えた動画と頼んだ地点の距離の上限（度。約 1 km）。ルールの nearEnough と同じ。遠い動画は届いたことにしない */
export const ANSWER_NEAR_DEG = 0.01;
const near = (m: MarkerData, s: RequestMarkerData) =>
  Math.abs(m.lat - s.lat) <= ANSWER_NEAR_DEG && Math.abs(m.lng - s.lng) <= ANSWER_NEAR_DEG;

/** 地点から動画を登録するとき、応えるリクエストの ID。自分のリクエストは除き、新しい順に上限まで。 */
export function answerTargets(spot: RequestMarkerData, uid: string | null): string[] {
  return (spot.entries ?? [])
    .filter((e) => e.ownerUid && e.ownerUid !== uid)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, MAX_ANSWERS)
    .map((e) => e.id);
}

/** 自分のリクエスト 1 件に届いた動画。 */
export interface DeliveredAnswer {
  spot: RequestMarkerData;
  entry: RequestEntrySummary;
  /** 応えた動画（新しい順）。ほかの人の投稿で、論理削除されていないものだけ */
  markers: MarkerData[];
}

/** 自分の未取り下げのリクエストのうち、動画が届いたもの（新しく届いた順）。 */
export function deliveredAnswers(markers: MarkerData[], spots: RequestMarkerData[], uid: string): DeliveredAnswer[] {
  const byRequest = new Map<string, MarkerData[]>();
  for (const m of markers) {
    if (m.deleted || !m.answers || m.ownerUid === uid) continue;
    for (const id of m.answers) byRequest.set(id, [...(byRequest.get(id) ?? []), m]);
  }
  const rows: DeliveredAnswer[] = [];
  for (const spot of spots) {
    for (const entry of spot.entries ?? []) {
      // 受け取れるのと同じ条件だけを出す（近くにあり、リクエストより後に登録された動画。ルールの answerable）
      const found = (entry.ownerUid === uid ? byRequest.get(entry.id) ?? [] : [])
        .filter((m) => near(m, spot) && (entry.createdAt === undefined || entry.createdAt < m.createdAt));
      if (found.length) rows.push({ spot, entry, markers: [...found].sort((a, b) => b.createdAt - a.createdAt) });
    }
  }
  return rows.sort((a, b) => b.markers[0].createdAt - a.markers[0].createdAt);
}
