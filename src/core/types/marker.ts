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
  source: 'gsi';
}

export interface MarkerData {
  id: string;
  youtubeUrl: string;
  /** YouTube の動画 ID（11 文字）。重複の禁止の索引 videos/{videoId} のキー。GitHub 経由の古い投稿には無い */
  videoId?: string;
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

  /** 投稿者の表示名（GitHub 経由なら GitHub アカウント名）。権限の判定には使わない */
  createdBy: string;
  /** 投稿者の Firebase の uid。本人かどうかの判定に使う。GitHub 経由の投稿には無い（ADR 0012） */
  ownerUid?: string;
  /** Loca に登録された時刻（epoch ms）。並び替えと期間フィルタの基準 */
  createdAt: number;
  updatedAt?: number;
  /** 取り下げ済み。公開データには含めないが、混入しても弾けるよう型には残す */
  deleted?: boolean;
}

/** 新規登録時の入力（id とタイムスタンプは取り込み側で採番）。 */
export type MarkerDraft = Omit<MarkerData, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 利用者が書き換えられる項目（Firestore への書き込み用）。
 * 持ち主・投稿者名・時刻・削除フラグはアダプタが決めるので含めない。
 */
export type MarkerContent = Pick<
  MarkerData,
  'youtubeUrl' | 'lat' | 'lng' | 'tags' | 'equipment' | 'title' | 'channelTitle' | 'thumbnailUrl' | 'prefecture' | 'city'
> & { videoId: string };

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
