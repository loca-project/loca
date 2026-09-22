import type { LatLng, PlaceMeta } from '@/core/types';
import type { Adapter } from './common';

/** 住所 ⇄ 座標の変換ポート。 */
export interface GeocodePort extends Adapter {
  /** 座標 → 都道府県・市町村。 */
  reverse(lat: number, lng: number): Promise<PlaceMeta>;
  /** 住所・地名 → 座標。見つからなければ UpstreamError。 */
  forward(address: string): Promise<LatLng>;
  /** 市町村まで返せる実装かどうか。offline 実装は都道府県までしか返せない。 */
  readonly providesCity: boolean;
}
