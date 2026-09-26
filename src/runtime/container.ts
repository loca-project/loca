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
import type { EmbeddingModelInfo, SemanticPort } from '@/ports/semantic';
import { ACTIVE_MODEL, MODELS } from '@/adapters/semantic/models';
import { canUseFirebase } from './config';

export interface Services {
  catalog: CatalogPort;
  map: MapPort;
  video: VideoMetaPort;
  geocode: GeocodePort;
  /** AI 検索のモデルの素性（読み込む前に大きさを案内するため。ADR 0033） */
  semanticModel: EmbeddingModelInfo;
  /** AI 検索。使ったときに初めて部品とモデルを読む（初期読み込みの JS に入れない） */
  semantic: () => Promise<SemanticPort>;
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
let semantic: Promise<SemanticPort> | null = null;

/** AI 検索の部品を遅延 import する。モデルは models.ts の ACTIVE_MODEL（差し替えはそこだけ） */
function loadSemantic(): Promise<SemanticPort> {
  semantic ??= import('@/adapters/semantic/transformers')
    .then(({ createTransformersSemantic }) => createTransformersSemantic(MODELS[ACTIVE_MODEL]))
    .catch((e) => {
      semantic = null;
      throw e;
    });
  return semantic;
}

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
      geocode: lazyGeocode,
      semanticModel: { id: MODELS[ACTIVE_MODEL].id, sizeMb: MODELS[ACTIVE_MODEL].sizeMb, rule: MODELS[ACTIVE_MODEL].rule },
      semantic: loadSemantic,
      ...write,
    };
  })();

  return services;
}
