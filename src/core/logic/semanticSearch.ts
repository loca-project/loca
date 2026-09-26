/**
 * AI 検索の組み立て（ADR 0033）。通信もモデルも持たない純粋な計算だけ。
 *
 * AI は検索語をタグに読み替えるだけで、タグを付けたり動画の中身を判定したりしない（ADR 0014 の決定 7）。
 * 1. 検索語とタグの説明文の埋め込みの近さ（内積）でタグを並べる
 * 2. 1 位が下限（minTop）未満なら読み替えない。地名・固有名詞は 1 位でも近さが低い（地名 25 語の 1 位は最大 0.268）
 * 3. 1 位から margin 以内のタグを最大 maxTags 個採る
 * 4. 結果は「語の一致」を先に、その後ろに「読み替えたタグを持つ動画」を並べる
 * 下限と幅はモデルごとに違う。モデルの設定（src/adapters/semantic/models.ts）が持ち、npm run semantic:eval で決める。
 */

import type { MarkerData } from '@/core/types';
import type { TagField } from '@/core/constants/tags';
import { searchMarkersByText } from './search';

export interface TagScore {
  key: string;
  field: TagField;
  score: number;
}

export interface TagPickRule {
  /** 1 位の近さがこれ未満なら読み替えない */
  minTop: number;
  /** 1 位からこの差までのタグを採る */
  margin: number;
  /** 採るタグの数の上限 */
  maxTags: number;
}

/** 正規化済みのベクトルの内積（= コサイン類似度） */
export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

/** 検索語のベクトルとタグのベクトルから、近い順のタグを返す */
export function rankTags(query: number[], tags: { key: string; field: TagField; vector: number[] }[]): TagScore[] {
  return tags
    .map((t) => ({ key: t.key, field: t.field, score: dot(query, t.vector) }))
    .sort((a, b) => b.score - a.score);
}

/** 規則に従ってタグを採る。1 位が下限未満なら空 */
export function pickTags(ranked: TagScore[], rule: TagPickRule): TagScore[] {
  const top = ranked[0];
  if (!top || top.score < rule.minTop) return [];
  return ranked.filter((t) => t.score >= top.score - rule.margin).slice(0, rule.maxTags);
}

/** 採ったタグのどれかを持つか。同じ項目（雰囲気など）の中は OR */
function hasAnyTag(m: MarkerData, tags: TagScore[]): boolean {
  const own = (m.tags ?? {}) as Partial<Record<TagField, string>>;
  return tags.some((t) => own[t.field] === t.key);
}

/**
 * 語の一致の結果の後ろに、読み替えたタグを持つ動画を足す（重複は除く）。
 * タグの動画は、採ったタグをより多く持つもの → 近さの高いタグを持つものの順。
 */
export function searchMarkersWithTags(markers: MarkerData[], query: string, tags: TagScore[]): MarkerData[] {
  const byText = searchMarkersByText(markers, query);
  if (tags.length === 0) return byText;
  const seen = new Set(byText.map((m) => m.id));
  const own = (m: MarkerData) => (m.tags ?? {}) as Partial<Record<TagField, string>>;
  const byTags = markers
    .filter((m) => !seen.has(m.id) && hasAnyTag(m, tags))
    .map((m) => {
      const matched = tags.filter((t) => own(m)[t.field] === t.key);
      return { m, count: matched.length, best: Math.max(...matched.map((t) => t.score)) };
    })
    .sort((a, b) => b.count - a.count || b.best - a.best)
    .map((r) => r.m);
  return [...byText, ...byTags];
}
