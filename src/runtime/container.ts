/**
 * コンポジションルート。
 *
 * 配信先が GitHub Pages に決まったため、各層の実装は 1 つずつに固定した。
 * 地図と地名はすべて国土地理院に統一し、予備の実装は持たない（ADR 0011）。
 * 認証と保存は Firebase の設定値がそろったときだけ読み込む。無ければ auth・markerStore・requestStore は null で、閲覧だけで動く（ADR 0010）。
 */

import type {
  AdminStorePort,
  AuthPort,
  CatalogPort,
  GeocodePort,
  LikeStorePort,
  MapPort,
  MarkerStorePort,
  ProfileStorePort,
  ReportStorePort,
  RequestStorePort,
  VideoMetaPort,
} from '@/ports';
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
  /** auth と同じく、Firebase が使えないときは null。 */
  markerStore: MarkerStorePort | null;
  requestStore: RequestStorePort | null;
  reportStore: ReportStorePort | null;
  likeStore: LikeStorePort | null;
  profileStore: ProfileStorePort | null;
  adminStore: AdminStorePort | null;
}

let services: Promise<Services> | null = null;

type WriteServices = Pick<Services, 'auth' | 'markerStore' | 'requestStore' | 'reportStore' | 'likeStore' | 'profileStore' | 'adminStore'>;

const NO_WRITE: WriteServices = { auth: null, markerStore: null, requestStore: null, reportStore: null, likeStore: null, profileStore: null, adminStore: null };

/** Firebase が使えない・初期化に失敗したときはすべて null。閲覧は止めない。 */
async function loadFirebase(): Promise<WriteServices> {
  if (!canUseFirebase()) return NO_WRITE;
  try {
    const { createFirebaseServices } = await import('@/adapters/firebase');
    return await createFirebaseServices();
  } catch (e) {
    console.error('[firebase] 初期化に失敗したため、ログインと保存を無効にして起動します', e);
    return NO_WRITE;
  }
}

export function getServices(): Promise<Services> {
  if (services) return services;

  services = (async () => {
    // 地図と Firebase は重いので遅延 import する（初期バンドルに載せない）
    const [{ MapLibreAdapter }, write] = await Promise.all([import('@/adapters/map/maplibre'), loadFirebase()]);
    return {
      catalog: staticCatalogAdapter,
      map: new MapLibreAdapter(),
      video: oembedVideoAdapter,
      geocode: gsiGeocodeAdapter,
      ...write,
    };
  })();

  return services;
}
