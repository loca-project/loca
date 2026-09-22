/** 「感情の核」に対応するマーカー色（要件 3.3）。 */
export const EMOTION_HEX: Record<string, string> = {
  興奮: '#E53935', // 赤 - 活発、エネルギー
  喜び: '#FB8C00', // オレンジ
  希望: '#FDD835', // 黄
  癒し: '#43A047', // 緑 - 自然、平穏
  悲しみ: '#1E88E5', // 青 - 深さ、共感
  驚き: '#00ACC1', // 水色
  恐怖: '#8E24AA', // 紫 - 緊張、暗さ
};

/** 仮マーカーおよび感情未設定時の色。要件 3.2 により仮マーカーは一律グレー。 */
export const NEUTRAL_HEX = '#9CA3AF';

/** 撮影リクエストマーカーの色（動画がまだ無い地点）。 */
export const REQUEST_HEX = '#111827';

export function emotionColor(emotion?: string): string {
  if (!emotion) return NEUTRAL_HEX;
  return EMOTION_HEX[emotion] ?? NEUTRAL_HEX;
}
