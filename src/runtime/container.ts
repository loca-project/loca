/**
 * コンポジションルート。
 *
 * 配信先が GitHub Pages に決まったため、各層の実装は 1 つずつに固定した。
 * 地図と地名はすべて OpenStreetMap（タイルと Nominatim）に統一し、予備の実装は持たない（ADR 0032）。
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
import type { EdgeAi } from './edgeAi';
import { canUseFirebase } from './config';

export interface Services {
  catalog: CatalogPort;
  map: MapPort;
  video: VideoMetaPort;
  geocode: GeocodePort;
  /** Edge AI（AI 検索。ADR 0033）。起動のときに準備し、使えなければ unavailable（検索は語の一致だけで続く） */
  edgeAi: EdgeAi;
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

/**
 * 地名検索・逆ジオコーディングは使ったときに Nominatim のアダプタを読む（初期読み込みの JS を 260 kB 以内に保つ。ADR 0032）。
 * 中身は src/adapters/geocode/nominatim.ts の nominatimGeocodeAdapter と同じ。
 */
const nominatim = () => import('@/adapters/geocode/nominatim').then((m) => m.nominatimGeocodeAdapter);
const lazyGeocode: GeocodePort = {
  name: 'nominatim',
  probe: async () => typeof fetch === 'function',
  reverse: async (lat, lng) => (await nominatim()).reverse(lat, lng),
  forward: async (address) => (await nominatim()).forward(address),
};

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

/**
 * サービスを解決する。起動画面の進み具合（0〜1。分からなければ null）を onProgress で知らせる。
 * Edge AI を先に準備してから、地図と Firebase をつなぐ（T101。どこで止まっているかを起動画面の % で分かるように）。
 */
export function getServices(onProgress?: (ratio: number | null) => void): Promise<Services> {
  if (services) return services;

  services = (async () => {
    const edgeAi = await import('./edgeAi').then((m) => m.startEdgeAi((ratio) => onProgress?.(ratio)));
    // 地図と Firebase は重いので遅延 import する（初期バンドルに載せない）
    const [{ MapLibreAdapter }, write] = await Promise.all([import('@/adapters/map/maplibre'), loadFirebase()]);
    return {
      catalog: staticCatalogAdapter,
      map: new MapLibreAdapter(),
      video: oembedVideoAdapter,
      geocode: lazyGeocode,
      edgeAi,
      ...write,
    };
  })();

  return services;
}
