import type { MarkerContent } from '@/core/types';
import type { Adapter } from './common';

/**
 * マーカーの書き込みポート（ADR 0010・0012）。
 * 読み取りは CatalogPort（markers.json）のまま。ここは書き込みだけを扱う。
 *
 * 持ち主（ownerUid）・投稿者名・時刻はアダプタがログイン中のユーザーから決める。
 * 権限と間隔（6 秒）はセキュリティルールが守り、違反は UpstreamError になる。
 */
export interface MarkerStorePort extends Adapter {
  /** 作成して新しい ID を返す。未ログインなら UpstreamError。 */
  create(content: MarkerContent): Promise<string>;
  /** 本人のマーカーを書き換える。渡した項目だけを変える。 */
  update(id: string, patch: Partial<MarkerContent>): Promise<void>;
  /** 本人のマーカーを論理削除する（deleted: true）。本人には戻せない。 */
  softDelete(id: string): Promise<void>;
}
