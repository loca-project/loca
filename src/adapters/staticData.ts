/**
 * 静的 JSON を読む唯一のデータ実装。
 *
 * 公開データは GitHub リポジトリ上の `public/data/*.json` にあり、
 * GitHub Actions が Issue を取り込んで更新する。データベースは使わない。
 * バックエンドが存在しないので「落ちる」対象が無く、GitHub Pages が生きていれば必ず読める。
 */

import type { EquipmentDef, MarkerData, RequestMarkerData } from '@/core/types';
import type { CatalogPort, CatalogSnapshot } from '@/ports';
import { EMPTY_SNAPSHOT } from '@/ports';
import { appConfig } from '@/runtime/config';

interface MarkerBundle {
  generatedAt?: number;
  markers?: MarkerData[];
}

interface RequestBundle {
  generatedAt?: number;
  markers?: RequestMarkerData[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      console.warn(`[loca] ${url} が ${res.status} を返しました`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[loca] ${url} を取得できませんでした`, e);
    return null;
  }
}

export const staticCatalogAdapter: CatalogPort = {
  name: 'static',

  async probe(): Promise<boolean> {
    return true;
  },

  /**
   * 3 ファイルを並行して読む。1 つ落ちても残りで描画する（部分的な欠損を許容する）。
   */
  async load(): Promise<CatalogSnapshot> {
    const base = appConfig.dataBaseUrl;
    const [markerBundle, requestBundle, equipment] = await Promise.all([
      fetchJson<MarkerBundle | MarkerData[]>(`${base}/markers.json`),
      fetchJson<RequestBundle | RequestMarkerData[]>(`${base}/requests.json`),
      fetchJson<EquipmentDef[]>(`${base}/equipment.json`),
    ]);

    if (!markerBundle && !requestBundle && !equipment) return EMPTY_SNAPSHOT;

    const markers = Array.isArray(markerBundle) ? markerBundle : (markerBundle?.markers ?? []);
    const requestMarkers = Array.isArray(requestBundle)
      ? requestBundle
      : (requestBundle?.markers ?? []);

    return {
      // 論理削除は公開データに含めない建前だが、混ざっていても弾く
      markers: markers.filter((m) => !m.deleted),
      requestMarkers,
      equipment: equipment ?? [],
      generatedAt: (Array.isArray(markerBundle) ? 0 : markerBundle?.generatedAt) ?? 0,
    };
  },
};
