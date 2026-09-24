import type { MoodKey } from './tags';

/**
 * 「雰囲気」に対応するマーカー色（要件 3.3・ADR 0014）。地図フィルタのチップも同じ色を使う。
 * 通常と 1 型・2 型・3 型の色覚で、仮マーカー・撮影リクエストを含む全組の CIEDE2000 が 17 以上。
 */
export const MOOD_HEX: Record<MoodKey, string> = {
  lively: '#ED7208', // 橙 - 活気、人の熱
  calm: '#237359', // 深緑 - 自然、平穏
  dreamy: '#C143EA', // 紫 - 非日常
  grand: '#0932A4', // 紺 - 深さ、スケール
  nostalgic: '#A99A7E', // ベージュ茶 - セピア、記憶
  thrill: '#C50707', // 赤 - 緊張、高揚
};

/** 仮マーカーおよび雰囲気が未設定・不明なときの色。要件 3.2 により仮マーカーは一律グレー。 */
export const NEUTRAL_HEX = '#9CA3AF';

/** 撮影リクエストマーカーの色（動画がまだ無い地点）。 */
export const REQUEST_HEX = '#111827';

export function moodColor(mood?: string): string {
  if (!mood) return NEUTRAL_HEX;
  return (MOOD_HEX as Record<string, string>)[mood] ?? NEUTRAL_HEX;
}
