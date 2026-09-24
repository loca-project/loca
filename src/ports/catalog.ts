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
  /** Firestore と最後に同期した時刻（epoch ms）。これより後の変更だけを購読する。0 なら全件 */
  syncedAt: number;
  /** requests.json の同期時刻。意味は syncedAt と同じ */
  requestsSyncedAt: number;
}

export const EMPTY_SNAPSHOT: CatalogSnapshot = {
  markers: [],
  requestMarkers: [],
  equipment: [],
  generatedAt: 0,
  syncedAt: 0,
  requestsSyncedAt: 0,
};
