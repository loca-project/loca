/**
 * 都道府県マスタ（取り込みスクリプト用）。
 *
 * クライアント側の src/core/constants/prefectures.ts と**同じ並び**である必要がある。
 * スクリプトは .mjs、アプリは .ts でビルド系統が違うため実体を共有できず二重管理になる。
 * ズレは `npm run verify` が検出する。
 */

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

/**
 * ISO 3166-2:JP のコード（JP-01〜JP-47）から都道府県名を引く。
 * Nominatim は東京 23 区などで province を返さないが、このコードは必ず返す。
 */
export function prefectureFromIsoCode(code) {
  if (!code) return '';
  const match = /^JP-(\d{2})$/.exec(String(code).trim().toUpperCase());
  if (!match) return '';
  return PREFECTURES[Number(match[1]) - 1] ?? '';
}
