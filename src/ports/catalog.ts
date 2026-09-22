import type { EquipmentDef, MarkerData, RequestMarkerData } from '@/core/types';
import type { Adapter } from './common';

/**
 * 公開データの読み取りポート。
 *
 * Loca はデータベースを持たない。公開されるデータはすべて GitHub リポジトリ上の
 * 静的 JSON であり、更新は GitHub Actions が push することで行われる。
 * そのため「書き込み」はこのポートに存在しない（書き込みは GitHub Issue 経由）。
 *
 * 将来データベースを導入する場合は、この 1 ポートに別実装を足せばよい。
 */
export interface CatalogPort extends Adapter {
  load(): Promise<CatalogSnapshot>;
}

export interface CatalogSnapshot {
  markers: MarkerData[];
  requestMarkers: RequestMarkerData[];
  equipment: EquipmentDef[];
  /** データが生成された時刻（epoch ms）。画面に鮮度を出すために使う */
  generatedAt: number;
}

export const EMPTY_SNAPSHOT: CatalogSnapshot = {
  markers: [],
  requestMarkers: [],
  equipment: [],
  generatedAt: 0,
};
