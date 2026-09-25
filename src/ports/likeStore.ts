import type { Adapter } from './common';

/** マーカー 1 件のいいねの状態。 */
export interface LikeState {
  count: number;
  /** ログイン中のユーザーが付けているか。未ログインなら false */
  liked: boolean;
}

/**
 * いいねのポート（ADR 0016・0024）。投稿者への「ありがとう」で、順位の基準にはしない。
 * 件数は誰でも読める。誰が付けたかは本人と管理者にしか読めない（ルールで守る）。
 */
export interface LikeStorePort extends Adapter {
  /** マーカーの件数と、自分が付けているか。 */
  state(markerId: string): Promise<LikeState>;
  /**
   * 付ける（liked: true）・外す（false）。付けたあとの状態を返す。
   * 未ログイン・自分のマーカー・続けて付けた（6 秒以内）などで拒否されたら UpstreamError。
   */
  set(marker: { id: string; ownerUid: string }, liked: boolean): Promise<LikeState>;
  /** 自分のマーカーが受け取った件数（マーカー ID → 件数。0 件のマーカーは含まない）。未ログインなら空。 */
  receivedByMine(): Promise<Record<string, number>>;
  /**
   * 投稿者の動画が受け取ったいいね（マーカー ID → 件数。0 件は含まない）。公開プロフィール（T82）。誰でも読める。
   * 削除した動画の件数の文書も返るので、合計は呼び出し側がいま地図にある動画の分だけ足す（利用者の判断）。
   */
  receivedBy(ownerUid: string): Promise<Record<string, number>>;
  /** 自分が付けたいいねをすべて外す（アカウント削除。ADR 0021）。外した件数を返す。 */
  unlikeAllMine(): Promise<number>;
}
