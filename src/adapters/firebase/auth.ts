/**
 * Firebase Auth による Google ログイン（ADR 0010）。
 *
 * GitHub Pages は Firebase 以外のドメインなので、リダイレクト方式はブラウザのストレージ分離で動かない。
 * ポップアップ方式（signInWithPopup）だけを使う。
 * セッションは getAuth の既定（ブラウザに永続）のまま。明示的にログアウトするまで保持する（要件 1.1）。
 */

import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import type { AuthPort, AuthUser, Unsubscribe } from '@/ports';
import { UpstreamError } from '@/ports';
import { firebaseApp } from './app';

/** 利用者が自分で閉じた・取り消したときのコード。失敗ではないので null を返す。 */
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

const MESSAGES: Record<string, string> = {
  'auth/popup-blocked': 'ログイン用のポップアップがブロックされました。ブラウザでポップアップを許可してください。',
  'auth/unauthorized-domain': 'このドメインはログインが許可されていません（Firebase の承認済みドメインを確認してください）。',
  'auth/network-request-failed': '通信に失敗しました。ネットワークを確認してください。',
};

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName ?? user.email ?? user.uid,
    email: user.email,
    photoUrl: user.photoURL,
  };
}

export class FirebaseAuthAdapter implements AuthPort {
  readonly name = 'firebase-auth';
  private readonly auth: Auth = getAuth(firebaseApp());

  async probe(): Promise<boolean> {
    // 保存済みのセッションの復元を待つ。これで currentUser() が最初から正しくなる。
    await this.auth.authStateReady();
    return true;
  }

  currentUser(): AuthUser | null {
    return toAuthUser(this.auth.currentUser);
  }

  onChange(cb: (user: AuthUser | null) => void): Unsubscribe {
    return onAuthStateChanged(this.auth, (user) => cb(toAuthUser(user)));
  }

  async signIn(): Promise<AuthUser | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(this.auth, provider);
      return toAuthUser(result.user);
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : '';
      if (CANCELLED.has(code)) return null;
      throw new UpstreamError(MESSAGES[code] ?? `ログインに失敗しました（${code || '不明なエラー'}）。`, e);
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (e) {
      throw new UpstreamError('ログアウトに失敗しました。', e);
    }
  }
}
