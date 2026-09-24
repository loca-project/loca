/**
 * 管理者画面のマーカー管理（要件 5.2.5）とログ一覧（5.2.3）の絞り込み（T60）。通信しない。
 * 投稿者名（createdBy）はいつもいまのニックネームにそろい、重複しない（ADR 0019 決定 7・9）ので、名前で探して uid で絞る。
 */

import type { MarkerData } from '@/core/types';

export interface PosterRow {
  ownerUid: string;
  name: string;
  count: number;
}

/** 名前に query を含む投稿者（大文字小文字を区別しない）を、マーカーの多い順に。query が空なら全員。 */
export function postersMatching(markers: MarkerData[], query: string): PosterRow[] {
  const q = query.trim().toLowerCase();
  const byUid = new Map<string, PosterRow>();
  for (const m of markers) {
    // 持ち主の無い古い形式の行は、管理の対象にできないので数えない
    const uid = m.ownerUid;
    if (!uid || m.deleted || (q && !m.createdBy.toLowerCase().includes(q))) continue;
    const row = byUid.get(uid) ?? { ownerUid: uid, name: m.createdBy, count: 0 };
    row.count += 1;
    byUid.set(uid, row);
  }
  return [...byUid.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** その人のマーカーを、更新の新しい順に。 */
export function markersOfOwner(markers: MarkerData[], ownerUid: string): MarkerData[] {
  return markers.filter((m) => m.ownerUid === ownerUid && !m.deleted).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * ログ一覧の行。更新の新しい順に、題名・投稿者名・マーカー ID・uid に query を含むものを limit 件まで。
 * total は絞り込んだ件数（limit で切る前）。
 */
export function logRows(markers: MarkerData[], query: string, limit: number): { rows: MarkerData[]; total: number } {
  const q = query.trim().toLowerCase();
  const hit = (m: MarkerData) =>
    !q || [m.title ?? '', m.createdBy ?? '', m.id, m.ownerUid ?? ''].some((s) => s.toLowerCase().includes(q));
  const all = markers.filter(hit).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return { rows: all.slice(0, limit), total: all.length };
}
