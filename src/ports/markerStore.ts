import type { MarkerContent, MarkerData } from '@/core/types';
import type { Adapter, Unsubscribe } from './common';

/**
 * マーカーの書き込みポート（ADR 0010・0012）。
 * 閲覧の土台は CatalogPort（markers.json）。ここは書き込みと、その後の差分の購読を扱う（要件 1.4）。
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
  /**
   * sinceMs（markers.json の生成時刻）より後に updatedAt が変わったマーカーを購読する。
   * 変わった行だけが届く。deleted: true の行は一覧から外すこと。登録直後にも現在の差分で 1 回呼ぶ。
   */
  subscribeChanges(sinceMs: number, onChange: (changed: MarkerData[]) => void, onError: (e: Error) => void): Unsubscribe;
}
