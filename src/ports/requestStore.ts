import type { RequestContent, RequestEntry } from '@/core/types';
import type { Adapter, Unsubscribe } from './common';

/**
 * 撮影リクエストの書き込みポート（熱量は 1 利用者あたり合計 5 まで）。
 * 閲覧の土台は requests.json（CatalogPort）。ここは書き込みと、その後の差分の購読を扱う。
 * 上限はセキュリティルールが守る。ここでの残り熱量は表示と事前の確認に使う。
 */
export interface RequestStorePort extends Adapter {
  /** ログイン中のユーザーが使った熱量の合計（0〜5）。未ログインなら 0。 */
  heatUsed(): Promise<number>;
  /** 作成して、集計に足せる形で返す。上限を超える・未ログインなら UpstreamError。 */
  create(content: RequestContent): Promise<RequestEntry>;
  /** sinceMs（requests.json の syncedAt）より後に作られたリクエストを購読する。 */
  subscribeChanges(sinceMs: number, onChange: (added: RequestEntry[]) => void, onError: (e: Error) => void): Unsubscribe;
}