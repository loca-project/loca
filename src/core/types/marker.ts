/** マーカー（登録済み動画）のドメイン型。 */

/** 感情タグ3カテゴリ。各カテゴリから1つだけ選ぶ（排他）。 */
export interface EmotionTags {
  /** 行動への影響 (Actionable Intent) */
  action: string;
  /** 動画の雰囲気 (Atmosphere/Vibe) */
  atmosphere: string;
  /** 感情の核 (Core Emotion)。マーカー色の決定に使う */
  emotion: string;
}

/** 撮影機器。未選択は空文字で表す。 */
export interface Equipment {
  manufacturer: string;
  series: string;
  model: string;
}

/**
 * 動画メタデータ。
 *
 * Google API を使わないため、取得できるのは YouTube oEmbed が返す 3 項目だけ。
 * 再生数・投稿日・再生時間は取得手段が無いので、この型には持たない。
 */
export interface VideoMeta {
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  source: 'oembed';
}

/** 逆ジオコーディングの結果。 */
export interface PlaceMeta {
  prefecture: string;
  city: string;
  source: 'nominatim' | 'offline';
}

export interface MarkerData {
  id: string;
  youtubeUrl: string;
  lat: number;
  lng: number;

  tags: EmotionTags;
  equipment: Equipment;

  // oEmbed から取得した情報
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;

  prefecture?: string;
  city?: string;

  /** 投稿した GitHub アカウント名 */
  createdBy: string;
  /** Loca に登録された時刻（epoch ms）。並び替えと期間フィルタの基準 */
  createdAt: number;
  updatedAt?: number;
  /** 取り下げ済み。公開データには含めないが、混入しても弾けるよう型には残す */
  deleted?: boolean;
}

/** 新規登録時の入力（id とタイムスタンプは取り込み側で採番）。 */
export type MarkerDraft = Omit<MarkerData, 'id' | 'createdAt' | 'updatedAt'>;

/** 地図上の矩形範囲（範囲指定検索で使う）。 */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}
