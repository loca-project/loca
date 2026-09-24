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
  /** 同意（CONSENT_VERSION）とニックネームで登録する。同意日時はサーバーの時刻。 */
  register(nickname: string): Promise<void>;
  /** ニックネームを変える。既存のマーカーの投稿者名は変わらない。 */
  rename(nickname: string): Promise<void>;
}
