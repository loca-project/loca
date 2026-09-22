/**
 * 都道府県の代表点（県庁所在地）の座標。
 *
 * オフライン判定用の近似データであり、行政界そのものではない。
 * 県境付近や離島では隣県に寄ることがある。正確さが要る構成では
 * VITE_ADAPTER_GEOCODE=nominatim または google を選ぶこと。
 */

export interface PrefectureCentroid {
  name: string;
  lat: number;
  lng: number;
}

export const PREFECTURE_CENTROIDS: PrefectureCentroid[] = [
  { name: '北海道', lat: 43.064, lng: 141.347 },
  { name: '青森県', lat: 40.824, lng: 140.74 },
  { name: '岩手県', lat: 39.704, lng: 141.153 },
  { name: '宮城県', lat: 38.269, lng: 140.872 },
  { name: '秋田県', lat: 39.719, lng: 140.102 },
  { name: '山形県', lat: 38.24, lng: 140.364 },
  { name: '福島県', lat: 37.75, lng: 140.468 },
  { name: '茨城県', lat: 36.342, lng: 140.447 },
  { name: '栃木県', lat: 36.566, lng: 139.884 },
  { name: '群馬県', lat: 36.391, lng: 139.061 },
  { name: '埼玉県', lat: 35.857, lng: 139.649 },
  { name: '千葉県', lat: 35.605, lng: 140.123 },
  { name: '東京都', lat: 35.69, lng: 139.692 },
  { name: '神奈川県', lat: 35.448, lng: 139.643 },
  { name: '新潟県', lat: 37.902, lng: 139.023 },
  { name: '富山県', lat: 36.695, lng: 137.211 },
  { name: '石川県', lat: 36.595, lng: 136.626 },
  { name: '福井県', lat: 36.065, lng: 136.222 },
  { name: '山梨県', lat: 35.664, lng: 138.568 },
  { name: '長野県', lat: 36.651, lng: 138.181 },
  { name: '岐阜県', lat: 35.391, lng: 136.722 },
  { name: '静岡県', lat: 34.977, lng: 138.383 },
  { name: '愛知県', lat: 35.18, lng: 136.907 },
  { name: '三重県', lat: 34.73, lng: 136.509 },
  { name: '滋賀県', lat: 35.005, lng: 135.869 },
  { name: '京都府', lat: 35.021, lng: 135.756 },
  { name: '大阪府', lat: 34.686, lng: 135.52 },
  { name: '兵庫県', lat: 34.691, lng: 135.183 },
  { name: '奈良県', lat: 34.685, lng: 135.833 },
  { name: '和歌山県', lat: 34.226, lng: 135.167 },
  { name: '鳥取県', lat: 35.504, lng: 134.238 },
  { name: '島根県', lat: 35.472, lng: 133.051 },
  { name: '岡山県', lat: 34.662, lng: 133.935 },
  { name: '広島県', lat: 34.396, lng: 132.46 },
  { name: '山口県', lat: 34.186, lng: 131.471 },
  { name: '徳島県', lat: 34.066, lng: 134.559 },
  { name: '香川県', lat: 34.34, lng: 134.043 },
  { name: '愛媛県', lat: 33.842, lng: 132.766 },
  { name: '高知県', lat: 33.56, lng: 133.531 },
  { name: '福岡県', lat: 33.607, lng: 130.418 },
  { name: '佐賀県', lat: 33.249, lng: 130.3 },
  { name: '長崎県', lat: 32.745, lng: 129.874 },
  { name: '熊本県', lat: 32.79, lng: 130.742 },
  { name: '大分県', lat: 33.238, lng: 131.613 },
  { name: '宮崎県', lat: 31.911, lng: 131.424 },
  { name: '鹿児島県', lat: 31.56, lng: 130.558 },
  { name: '沖縄県', lat: 26.212, lng: 127.681 },
];

/** 最も近い代表点の都道府県名を返す。日本域外なら空文字。 */
export function nearestPrefecture(lat: number, lng: number): string {
  if (lat < 20 || lat > 46.5 || lng < 122 || lng > 154) return '';
  let best = '';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of PREFECTURE_CENTROIDS) {
    const dLat = p.lat - lat;
    // 経度差は緯度に応じて縮むので cos 補正する
    const dLng = (p.lng - lng) * Math.cos((lat * Math.PI) / 180);
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = p.name;
    }
  }
  return best;
}

export function centroidOf(prefecture: string): PrefectureCentroid | undefined {
  return PREFECTURE_CENTROIDS.find((p) => p.name === prefecture || p.name.startsWith(prefecture));
}
