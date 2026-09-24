/**
 * マーカー検索。ランキングとは要件が異なる（件数制限を設けない）ため、
 * 意図的にランキング側とロジックを分離している（要件 1.2 / 3.1）。
 *
 * 語の一致だけで順位付けする。外部の推論モデルには依存しない。
 */

import type { Bounds, MarkerData } from '@/core/types';
import { TAG_FIELDS, tagLabel } from '@/core/constants/tags';
import { isInsideBounds } from './geo';

/** 日本語を素朴に分かち書きする。非 ASCII を 1 文字ずつ区切る。 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/([^\x01-\x7E])/g, ' $1 ')
    .split(/[\s、。,.!?/|()[\]{}"'`~]+/)
    .filter(Boolean);
}

/** 検索対象にする文字列を 1 本にまとめる。 */
function haystack(m: MarkerData): string {
  return [
    m.title,
    m.channelTitle,
    m.prefecture,
    m.city,
    // タグはキーではなく語で当てる（日本語・英語のどちらで検索しても当たるように）
    ...TAG_FIELDS.flatMap((field) => [tagLabel(m.tags?.[field], 'ja'), tagLabel(m.tags?.[field], 'en')]),
    m.memo,
    m.equipment?.manufacturer,
    m.equipment?.series,
    m.equipment?.model,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * フリーテキストでマーカーを絞り込む。件数制限なし。
 *
 * 1. 語をすべて含むもの（AND）を最優先
 * 2. 一部だけ含むものを一致率の高い順に続ける
 */
export function searchMarkersByText(markers: MarkerData[], query: string): MarkerData[] {
  const terms = tokenize(query);
  if (terms.length === 0) return markers;

  const scored = markers
    .map((m) => {
      const text = haystack(m);
      const hits = terms.filter((t) => text.includes(t)).length;
      return { marker: m, score: hits / terms.length };
    })
    .filter((r) => r.score > 0);

  return scored.sort((a, b) => b.score - a.score).map((r) => r.marker);
}

/** 描画した矩形の内側にあるマーカーだけを返す（要件 3.1.3）。件数制限なし。 */
export function searchMarkersByBounds(markers: MarkerData[], bounds: Bounds): MarkerData[] {
  return markers.filter((m) => isInsideBounds({ lat: m.lat, lng: m.lng }, bounds));
}

/** 同じ動画が既に登録されていないか（取り下げ済みは除外して判定）。 */
export function findDuplicateByVideoId(
  markers: MarkerData[],
  videoId: string,
  toId: (url: string) => string | null,
  excludeMarkerId?: string,
): MarkerData | undefined {
  return markers.find(
    (m) => !m.deleted && m.id !== excludeMarkerId && toId(m.youtubeUrl) === videoId,
  );
}
