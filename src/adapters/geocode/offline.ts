/**
 * オフライン・ジオコーディング（既定）。
 * ネットワークにも API キーにも依存しないため、必ず結果を返せる。
 * 市町村は返さない（providesCity = false）。
 */

import type { LatLng, PlaceMeta } from '@/core/types';
import type { GeocodePort } from '@/ports';
import { UpstreamError } from '@/ports';
import { centroidOf, nearestPrefecture } from './prefectureCentroids';

export const offlineGeocodeAdapter: GeocodePort = {
  name: 'offline',
  providesCity: false,

  async probe(): Promise<boolean> {
    return true;
  },

  async reverse(lat: number, lng: number): Promise<PlaceMeta> {
    return { prefecture: nearestPrefecture(lat, lng), city: '', source: 'offline' };
  },

  /** 都道府県名が含まれていればその代表点を返す。それ以外は解決できない。 */
  async forward(address: string): Promise<LatLng> {
    const query = address.trim();
    const hit = centroidOf(query) ?? centroidOf(query.replace(/[都道府県市区町村].*$/, ''));
    if (!hit) {
      throw new UpstreamError(
        'オフライン設定では都道府県名しか検索できません。地名で検索するには VITE_ADAPTER_GEOCODE を変更してください。',
      );
    }
    return { lat: hit.lat, lng: hit.lng };
  },
};
