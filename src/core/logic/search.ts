/**
 * マーカー検索。ランキングとは要件が異なる（件数制限を設けない）ため、
 * 意図的にランキング側とロジックを分離している（要件 1.2 / 3.1）。
 *
 * 語の一致だけで順位付けする。外部の推論モデルには依存しない。
 * AI 検索の読み替え（ADR 0033）は semanticSearch.ts が、この結果の後ろに足す。
 */

import type { Bounds, MarkerData } from '@/core/types';
import { TAG_FIELDS, tagLabel } from '@/core/constants/tags';
import { equipmentCategoryLabel } from '@/core/constants/equipment';
import { isInsideBounds } from './geo';

/**
 * 語の区切りに使う助詞（「千葉の富里」を「千葉」「富里」に分ける）。
 * 漢字・カタカナに挟まれたときだけ区切る（「おにぎり」の「に」は区切らない）
 */
const PARTICLES = /(?<=[一-鿿゠-ヿ])[のでとにへやをはが](?=[一-鿿゠-ヿ])/g;

/**
 * 検索語を照合の単位に分ける。英数字は語のまま、日本語は 2 文字ずつ（「鹿児島」→「鹿児」「児島」）。
 * 1 文字ずつに分けると「鹿児島県鹿屋市串良町」が「県」「市」だけで千葉県富里市のマーカーに当たった（2026-09-26）。
 * 1 文字だけの日本語はそのまま残す。
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(PARTICLES, ' ')
    .replace(/([\x01-\x7E]+)/g, ' $1 ')
    .split(/[\s、。,.!?/|()[\]{}"'`~]+/)
    .filter(Boolean);
  return words.flatMap((w) => {
    if (/^[\x01-\x7E]+$/.test(w) || w.length < 2) return [w];
    const chars = [...w];
    return chars.slice(0, -1).map((c, i) => c + chars[i + 1]);
  });
}

/** 語の一致の割合がこれ未満のマーカーは結果に出さない（部分的な偶然の一致を除く） */
export const MIN_TEXT_SCORE = 0.6;

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
    equipmentCategoryLabel(m.equipment?.category, 'ja'),
    equipmentCategoryLabel(m.equipment?.category, 'en'),
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
 * 2. 一致率が MIN_TEXT_SCORE 以上のものを、一致率の高い順に続ける
 */
export function searchMarkersByText(markers: MarkerData[], query: string): MarkerData[] {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return markers;

  const scored = markers
    .map((m) => {
      const text = haystack(m);
      const hits = terms.filter((t) => text.includes(t)).length;
      return { marker: m, score: hits / terms.length };
    })
    .filter((r) => r.score >= MIN_TEXT_SCORE);

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
