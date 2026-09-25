import type { RequestContent, RequestEntry } from '@/core/types';
import type { Adapter, Unsubscribe } from './common';

/** 受け取った炎（answerCounts。ADR 0028）。heat は熱量の合計、count は応えたリクエストの件数。 */
export interface Flames {
  heat: number;
  count: number;
}

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
  /** 動画が受け取った炎（熱量の合計と、応えたリクエストの件数。ADR 0028）。誰でも読める。無ければ 0。 */
  flamesOf(markerId: string): Promise<Flames>;
  /**
   * 投稿者の動画が受け取った炎（マーカー ID → 炎。公開プロフィール。T82）。誰でも読める。
   * 削除した動画の分も返るので、合計は呼び出し側がいま地図にある動画の分だけ足す（利用者の判断）。
   */
  flamesBy(ownerUid: string): Promise<Record<string, Flames>>;
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