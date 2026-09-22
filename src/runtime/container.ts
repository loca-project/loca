/**
 * コンポジションルート。
 *
 * 配信先が GitHub Pages に決まったため、各層の実装は 1 つずつに固定した。
 * 残しているのはジオコーディングのフォールバックだけで、これは公開インスタンスの
 * 可用性が保証されていないため（Nominatim が落ちても登録フローを止めない）。
 */

import type { CatalogPort, GeocodePort, MapPort, VideoMetaPort } from '@/ports';
import { staticCatalogAdapter } from '@/adapters/staticData';
import { oembedVideoAdapter } from '@/adapters/video/oembed';
import { nominatimGeocodeAdapter } from '@/adapters/geocode/nominatim';
import { offlineGeocodeAdapter } from '@/adapters/geocode/offline';

export interface Services {
  catalog: CatalogPort;
  map: MapPort;
  video: VideoMetaPort;
  geocode: GeocodePort;
}

let services: Promise<Services> | null = null;

/** Nominatim が使えなければオフライン実装へ落とす。 */
async function resolveGeocode(): Promise<GeocodePort> {
  try {
    if (await nominatimGeocodeAdapter.probe()) return nominatimGeocodeAdapter;
  } catch (e) {
    console.warn('[loca] Nominatim を初期化できないためオフライン実装に切り替えます', e);
  }
  return offlineGeocodeAdapter;
}

export function getServices(): Promise<Services> {
  if (services) return services;

  services = (async () => {
    // 地図は重いので遅延 import する（初期バンドルに載せない）
    const { MapLibreAdapter } = await import('@/adapters/map/maplibre');
    return {
      catalog: staticCatalogAdapter,
      map: new MapLibreAdapter(),
      video: oembedVideoAdapter,
      geocode: await resolveGeocode(),
    };
  })();

  return services;
}
