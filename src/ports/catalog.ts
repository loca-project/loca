import type { EquipmentDef, MarkerData, RequestMarkerData } from '@/core/types';
import type { Adapter } from './common';

/**
 * 公開データの読み取りポート。
 *
 * 閲覧の土台は GitHub リポジトリ上の静的 JSON（markers.json）で、GitHub Actions が作り直す（ADR 0004・0010）。
 * 書き込みはこのポートに無い。Firestore への書き込みは MarkerStorePort が担う。
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
