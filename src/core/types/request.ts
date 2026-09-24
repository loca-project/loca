/** 撮影リクエスト（まだ動画が無い地点への「撮ってほしい」表明）。 */

import type { SeasonKey, StyleKey, TimeOfDayKey } from '@/core/constants/tags';
import type { Equipment } from './marker';

/** どう撮ってほしいか。語とキーは動画のタグと同じ（ADR 0014）。未選択の項目は持たない */
export interface RequestTags {
  season?: SeasonKey;
  timeOfDay?: TimeOfDayKey;
  style?: StyleKey;
}

/** 地点ごとの集計マーカー。個別リクエストの合計値を持つ。 */
export interface RequestMarkerData {
  id: string;
  lat: number;
  lng: number;
  /** 全リクエストの熱量合計 */
  totalHeat: number;
  requestCount: number;
  updatedAt: number;
  prefecture?: string;
  city?: string;
  /** 集計に含めたリクエスト。二重に数えないため・内訳を出すため・本人の取り下げのために使う */
  entries?: RequestEntrySummary[];
}

/** 地点に集めたリクエスト 1 件の要約（requests.json の entries と同じ形）。 */
export interface RequestEntrySummary extends RequestTags {
  id: string;
  heat: number;
  equipment?: Equipment;
  /** 投稿者の uid（本人の取り下げに使う） */
  ownerUid?: string;
  createdAt?: number;
}

/** 保存する撮影リクエストの内容（Firestore の requests/{id}）。 */
export interface RequestContent extends RequestTags {
  lat: number;
  lng: number;
  /** 1〜5 */
  heat: number;
  equipment: Equipment;
}

/** Firestore から届いた 1 件。地点ごとの集計（RequestMarkerData）の材料になる。 */
export interface RequestEntry extends RequestContent {
  id: string;
  ownerUid: string;
  /** epoch ms */
  createdAt: number;
}

/** 1 利用者が保有できる熱量の上限。 */
export const MAX_HEAT_PER_USER = 5;
