/**
 * 取り込み時の検証。
 * Issue フォームの見出しラベルとフィールド名の対応もここに置く
 * （.github/ISSUE_TEMPLATE/*.yml の label と一致させること）。
 */

export const MARKER_LABELS = {
  'Youtube URL': 'videoUrl',
  緯度: 'lat',
  経度: 'lng',
  '行動への影響': 'tagAction',
  '動画の雰囲気': 'tagAtmosphere',
  '感情の核': 'tagEmotion',
  'メーカー': 'manufacturer',
  'シリーズ': 'series',
  'モデル': 'model',
};

export const REQUEST_LABELS = {
  緯度: 'lat',
  経度: 'lng',
  '熱量': 'heat',
  '季節': 'season',
  '撮影時間帯': 'timeOfDay',
  '撮影雰囲気': 'atmosphere',
  'メーカー': 'manufacturer',
  'シリーズ': 'series',
  'モデル': 'model',
};

const TAG_OPTIONS = {
  tagAction: ['訪問/地域紹介', '映像制作', 'お祭り/イベント', '機器/技術紹介'],
  tagAtmosphere: ['明るい', '真面目', '落ち着いた', '緊張', '幻想的', 'スマート'],
  tagEmotion: ['喜び', '興奮', '癒し', '驚き', '恐怖', '悲しみ', '希望'],
};

function checkCoords(lat, lng) {
  const errors = [];
  if (lat == null || lat < -90 || lat > 90) errors.push('緯度の値が正しくありません（-90〜90）。');
  if (lng == null || lng < -180 || lng > 180) errors.push('経度の値が正しくありません（-180〜180）。');
  return errors;
}

export function validateMarker({ lat, lng, fields }) {
  const errors = checkCoords(lat, lng);

  for (const [key, options] of Object.entries(TAG_OPTIONS)) {
    const value = fields[key];
    if (!value) {
      errors.push(`${key} が未選択です。`);
    } else if (!options.includes(value)) {
      errors.push(`${key} の値「${value}」は選択肢にありません。`);
    }
  }

  // 機器は任意。ただしシリーズ・モデルだけ書かれている状態は受け付けない
  if (!fields.manufacturer && (fields.series || fields.model)) {
    errors.push('メーカーを選ばずにシリーズ・モデルだけを指定することはできません。');
  }

  return errors;
}

export function validateRequest({ lat, lng, heat }) {
  const errors = checkCoords(lat, lng);
  if (heat == null || !Number.isInteger(heat) || heat < 1 || heat > 5) {
    errors.push('熱量は 1〜5 の整数で指定してください。');
  }
  return errors;
}
