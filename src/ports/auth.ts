import type { Adapter, Unsubscribe } from './common';

/** ログイン中のユーザー。表示に要る最小限だけを持つ。 */
export interface AuthUser {
  uid: string;
  displayName: string;
  email: string | null;
  photoUrl: string | null;
}

/**
 * 認証ポート（ADR 0010）。
 * ここでの判定は表示の切り替えにだけ使う。権限はセキュリティルールが守る。
 */
export interface AuthPort extends Adapter {
  /** 現在のユーザー。未ログイン、または状態の復元前なら null。 */
  currentUser(): AuthUser | null;
  /** ログイン状態の変化を購読する。登録直後にも現在の状態で 1 回呼ぶ。 */
  onChange(cb: (user: AuthUser | null) => void): Unsubscribe;
  /** Google でログインする。利用者がポップアップを閉じたら null。失敗は UpstreamError。 */
  signIn(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
}
