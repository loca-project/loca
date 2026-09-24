import type { UserProfile } from '@/core/types';
import type { Adapter, Unsubscribe } from './common';

/**
 * プロフィールのポート（要件 1.1・2.5・2.6・ADR 0019）。
 * 読み書きできるのは本人だけ（ルールで守る）。未ログインでの呼び出しは UpstreamError。
 */
export interface ProfileStorePort extends Adapter {
  /**
   * uid のプロフィールを購読する。未登録なら null。登録直後にも現在の値で 1 回呼ぶ。
   * 読めなかったときは onError（未登録と区別するため、null にはしない）。
   */
  watch(uid: string, onChange: (profile: UserProfile | null) => void, onError: (e: Error) => void): Unsubscribe;
  /** 同意（CONSENT_VERSION）とニックネームで登録する。同意日時はサーバーの時刻。ほかの人が使っている名前は UpstreamError。 */
  register(nickname: string): Promise<void>;
  /**
   * ニックネームを変え、本人のマーカーの投稿者名も新しい名前にそろえる（ADR 0019 決定 7）。
   * ほかの人が使っている名前（大文字小文字の違いを除いて同じ。決定 9）、前の登録・変更から 60 秒たっていないときは UpstreamError。
   */
  rename(nickname: string): Promise<void>;
  /**
   * ログイン時の修復。名前の索引が無ければ取り（重複の禁止より前に登録した人）、
   * 本人のマーカーのうち投稿者名がいまのニックネームと違うものをそろえる（途中で失敗した変更）。そろえた件数を返す。
   */
  repair(nickname: string): Promise<number>;
  /** プロフィールと名前の索引を消す（アカウント削除の最後の Firestore の手順。ADR 0021）。 */
  remove(): Promise<void>;
}
