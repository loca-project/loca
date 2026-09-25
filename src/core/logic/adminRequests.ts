/**
 * 管理者画面の「撮影リクエスト」タブの絞り込み（要件 5.2.5）。通信しない。
 * リクエストはニックネームを持たない（ownerUid だけ）ので、ニックネームは呼び出し側が uid から引いて渡す。
 * 取り下げ済みは地図の一覧にもともと無いので出ない。
 */

import type { RequestEntrySummary, RequestMarkerData } from '@/core/types';
import type { PosterRow } from './adminMarkers';

/** 地点 1 つぶん。entries は、その地点のうち対象の人のリクエストだけ。 */
export interface AdminRequestSpot {
  spot: RequestMarkerData;
  entries: (RequestEntrySummary & { ownerUid: string })[];
  heat: number;
  /** 対象のリクエストの最新の日時（epoch ms。不明なら 0） */
  latestAt: number;
}

/** 名前に query を含む（大文字小文字を区別しない）リクエストの持ち主を、件数の多い順に。query が空なら全員。 */
export function requestPosters(
  spots: RequestMarkerData[],
  nameOf: (uid: string) => string,
  query: string,
): PosterRow[] {
  const q = query.trim().toLowerCase();
  const byUid = new Map<string, PosterRow>();
  for (const spot of spots) {
    for (const e of spot.entries ?? []) {
      // 持ち主の無い古い形式の行は、取り下げの対象にできないので数えない
      if (!e.ownerUid) continue;
      const row = byUid.get(e.ownerUid) ?? { ownerUid: e.ownerUid, name: nameOf(e.ownerUid), count: 0 };
      row.count += 1;
      byUid.set(e.ownerUid, row);
    }
  }
  return [...byUid.values()]
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** owners のリクエストがある地点を、新しく出した順に。 */
export function requestSpotsOf(spots: RequestMarkerData[], owners: ReadonlySet<string>): AdminRequestSpot[] {
  const rows: AdminRequestSpot[] = [];
  for (const spot of spots) {
    const entries = (spot.entries ?? []).filter(
      (e): e is RequestEntrySummary & { ownerUid: string } => !!e.ownerUid && owners.has(e.ownerUid),
    );
    if (entries.length === 0) continue;
    rows.push({
      spot,
      entries,
      heat: entries.reduce((sum, e) => sum + e.heat, 0),
      latestAt: Math.max(...entries.map((e) => e.createdAt ?? 0)),
    });
  }
  return rows.sort((a, b) => b.latestAt - a.latestAt);
}
