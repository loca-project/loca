/**
 * コンポジションルート。
 *
 * 配信先が GitHub Pages に決まったため、各層の実装は 1 つずつに固定した。
 * 地図と地名はすべて国土地理院に統一し、予備の実装は持たない（ADR 0011）。
 * 認証は Firebase の設定値がそろったときだけ読み込む。無ければ auth は null で、閲覧だけで動く（ADR 0010）。
 */

import type { AuthPort, CatalogPort, GeocodePort, MapPort, VideoMetaPort } from '@/ports';
import { staticCatalogAdapter } from '@/adapters/staticData';
import { oembedVideoAdapter } from '@/adapters/video/oembed';
import { gsiGeocodeAdapter } from '@/adapters/geocode/gsi';
import { canUseFirebase } from './config';

export interface Services {
  catalog: CatalogPort;
  map: MapPort;
  video: VideoMetaPort;
  geocode: GeocodePort;
  /** null なら書き込み機能（ログイン・保存）は無効。 */
  auth: AuthPort | null;
}

let services: Promise<Services> | null = null;

/** Firebase が使えない・初期化に失敗したときは null。閲覧は止めない。 */
async function loadAuth(): Promise<AuthPort | null> {
  if (!canUseFirebase()) return null;
  try {
    const { FirebaseAuthAdapter } = await import('@/adapters/firebase/auth');
    const auth = new FirebaseAuthAdapter();
    return (await auth.probe()) ? auth : null;
  } catch (e) {
    console.error('[auth] Firebase の初期化に失敗したため、ログインを無効にして起動します', e);
    return null;
  }
}

export function getServices(): Promise<Services> {
  if (services) return services;

  services = (async () => {
    // 地図と Firebase は重いので遅延 import する（初期バンドルに載せない）
    const [{ MapLibreAdapter }, auth] = await Promise.all([import('@/adapters/map/maplibre'), loadAuth()]);
    return {
      catalog: staticCatalogAdapter,
      map: new MapLibreAdapter(),
      video: oembedVideoAdapter,
      geocode: gsiGeocodeAdapter,
      auth,
    };
  })();

  return services;
}
