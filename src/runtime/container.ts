/**
 * コンポジションルート。
 *
 * 配信先が GitHub Pages に決まったため、各層の実装は 1 つずつに固定した。
 * 地図と地名はすべて国土地理院に統一し、予備の実装は持たない（ADR 0011）。
 */

import type { CatalogPort, GeocodePort, MapPort, VideoMetaPort } from '@/ports';
import { staticCatalogAdapter } from '@/adapters/staticData';
import { oembedVideoAdapter } from '@/adapters/video/oembed';
import { gsiGeocodeAdapter } from '@/adapters/geocode/gsi';

export interface Services {
  catalog: CatalogPort;
  map: MapPort;
  video: VideoMetaPort;
  geocode: GeocodePort;
}

let services: Promise<Services> | null = null;

export function getServices(): Promise<Services> {
  if (services) return services;

  services = (async () => {
    // 地図は重いので遅延 import する（初期バンドルに載せない）
    const { MapLibreAdapter } = await import('@/adapters/map/maplibre');
    return {
      catalog: staticCatalogAdapter,
      map: new MapLibreAdapter(),
      video: oembedVideoAdapter,
      geocode: gsiGeocodeAdapter,
    };
  })();

  return services;
}
