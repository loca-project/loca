/**
 * 人のタブ（T88・ADR 0031）。地図の一覧（公開データ＋差分の購読）から投稿者ごとに集計する。
 * Firestore は読まない。探せるのは動画を投稿している人だけ（利用者の判断）。本人の判定は ownerUid（ADR 0019 決定 9）。
 */

import type { MarkerData } from '@/core/types';
import { viewsOf } from './ranking';

/** 投稿者 1 人ぶん。 */
export interface PosterSummary {
  uid: string;
  /** 投稿者名。いちばん新しく登録したマーカーの createdBy（ニックネームに追従する。ADR 0019） */
  name: string;
  /** いま地図にある動画の本数（論理削除したものは数えない） */
  posts: number;
  /** その動画の再生数の合計（まだ取っていない動画は 0） */
  views: number;
  /** いちばん新しく登録した日時（epoch ms） */
  latestAt: number;
}

export type PosterOrder = 'views' | 'posts' | 'recent';

/** 投稿者ごとに本数・再生数・最新の登録日時をまとめる。ownerUid の無いマーカー（見本など）は入れない。 */
export function summarizePosters(markers: MarkerData[]): PosterSummary[] {
  const byUid = new Map<string, PosterSummary>();
  for (const m of markers) {
    if (!m.ownerUid || m.deleted) continue;
    const row = byUid.get(m.ownerUid);
    if (!row) {
      byUid.set(m.ownerUid, { uid: m.ownerUid, name: m.createdBy, posts: 1, views: viewsOf(m), latestAt: m.createdAt });
      continue;
    }
    row.posts += 1;
    row.views += viewsOf(m);
    if (m.createdAt > row.latestAt) {
      row.latestAt = m.createdAt;
      row.name = m.createdBy;
    }
  }
  return [...byUid.values()];
}

const COMPARE: Record<PosterOrder, (a: PosterSummary, b: PosterSummary) => number> = {
  // 同じなら本数、さらに新しい順（地域別などのランキングと同じ決め方）
  views: (a, b) => b.views - a.views || b.posts - a.posts || b.latestAt - a.latestAt,
  posts: (a, b) => b.posts - a.posts || b.views - a.views || b.latestAt - a.latestAt,
  recent: (a, b) => b.latestAt - a.latestAt,
};

/** 並べ替えて先頭から limit 人。 */
export function rankPosters(rows: PosterSummary[], order: PosterOrder, limit: number): PosterSummary[] {
  return [...rows].sort(COMPARE[order]).slice(0, limit);
}

/** 大文字と小文字、全角と半角を区別しない形にそろえる。 */
function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/**
 * 投稿者名の部分一致。空の語では何も返さない。
 * 名前が語で始まる人を先に、同じなら本数の多い順。
 */
export function searchPosters(rows: PosterSummary[], query: string, limit: number): PosterSummary[] {
  const q = normalize(query);
  if (!q) return [];
  return rows
    .map((row) => ({ row, at: normalize(row.name).indexOf(q) }))
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => Number(a.at !== 0) - Number(b.at !== 0) || COMPARE.posts(a.row, b.row))
    .slice(0, limit)
    .map((hit) => hit.row);
}
