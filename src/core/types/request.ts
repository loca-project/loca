/** 撮影リクエスト（まだ動画が無い地点への「撮ってほしい」表明）。 */

import type { Equipment } from './marker';

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
}

/** 個々の利用者が投じた 1 件のリクエスト。 */
export interface RequestEntryData {
  id: string;
  /** RequestMarkerData.id への参照 */
  markerId: string;
  userId: string;
  userDisplayName: string;
  /** 1〜5。1 利用者あたりの合計上限も 5 */
  heat: number;
  season: string;
  timeOfDay: string;
  atmosphere: string;
  equipment: Equipment;
  createdAt: number;
  updatedAt: number;
}

/** 1 利用者が保有できる熱量の上限。 */
export const MAX_HEAT_PER_USER = 5;
