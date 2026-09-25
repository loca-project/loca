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
  /** 本人のリクエストを取り下げる（論理削除）。熱量はその分戻る。 */
  withdraw(entry: { id: string; heat: number }): Promise<void>;
  /**
   * 本人のリクエストに応えた動画を受け取る（ADR 0028）。リクエストを閉じて熱量を戻し、その動画の炎（answerCounts）に熱量を足す。
   * 応えていない動画・自分の動画・論理削除された動画はルールが拒否する（UpstreamError）。
   */
  receive(entry: { id: string; heat: number }, marker: { id: string; ownerUid: string }): Promise<void>;
  /** 本人のリクエストをすべて取り下げる（アカウント削除。ADR 0021）。取り下げた件数を返す。 */
  withdrawAllMine(): Promise<number>;
  /**
   * sinceMs（requests.json の syncedAt）より後に作成・取り下げされたリクエストを購読する。
   * 取り下げられたものは removedIds で届く（同期より前に作られた行の取り下げも届く。ADR 0013）。
   */
  subscribeChanges(
    sinceMs: number,
    onChange: (added: RequestEntry[], removedIds: string[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe;
}