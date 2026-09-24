/**
 * 自分の投稿の一覧（T53）。地図の一覧（公開データ＋差分の購読）から、本人の uid のものだけを取り出す。
 * 論理削除・取り下げ済みは一覧にもともと無いので出ない。本人の判定は ownerUid（ニックネームではない。ADR 0019 決定 9）。
 */

import type { MarkerData, RequestMarkerData } from '@/core/types';

/** 自分が撮影リクエストを出した地点 1 つぶん。 */
export interface MyRequestSpot {
  spot: RequestMarkerData;
  /** 自分がこの地点に使った熱量の合計 */
  heat: number;
  /** 自分がこの地点に出した件数 */
  count: number;
  /** 自分の最新のリクエストの日時（epoch ms。不明なら 0） */
  latestAt: number;
}

/** 本人のマーカーを、新しく登録した順に。 */
export function myMarkers(markers: MarkerData[], uid: string): MarkerData[] {
  return markers
    .filter((m) => m.ownerUid === uid && !m.deleted)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** 本人が撮影リクエストを出した地点を、新しく出した順に。 */
export function myRequestSpots(spots: RequestMarkerData[], uid: string): MyRequestSpot[] {
  const rows: MyRequestSpot[] = [];
  for (const spot of spots) {
    const mine = (spot.entries ?? []).filter((e) => e.ownerUid === uid);
    if (mine.length === 0) continue;
    rows.push({
      spot,
      heat: mine.reduce((sum, e) => sum + e.heat, 0),
      count: mine.length,
      latestAt: Math.max(...mine.map((e) => e.createdAt ?? 0)),
    });
  }
  return rows.sort((a, b) => b.latestAt - a.latestAt);
}
