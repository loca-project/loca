/**
 * Firestore へのプロフィールの読み書き（rules/40-users.rules・ADR 0019）。
 * users/{uid} に、ニックネームと同意の版・日時だけを持つ。時刻はすべて serverTimestamp()。
 */

import {
  Timestamp,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { UserProfile } from '@/core/types';
import { CONSENT_VERSION, isValidNickname, normalizeNickname } from '@/core/logic/profile';
import type { AuthUser, ProfileStorePort, Unsubscribe } from '@/ports';
import { UpstreamError } from '@/ports';
import { toUpstream } from './errors';

const DENIED = 'プロフィールを保存できませんでした。ニックネームは 1〜20 字で、改行を含めないでください。';

function toProfile(uid: string, data: DocumentData): UserProfile {
  const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : 0);
  return {
    uid,
    nickname: String(data.nickname ?? ''),
    consentVersion: Number(data.consentVersion ?? 0),
    agreedAt: ms(data.agreedAt),
    createdAt: ms(data.createdAt),
    updatedAt: ms(data.updatedAt),
  };
}

export function createProfileStore(db: Firestore, currentUser: () => AuthUser | null): ProfileStorePort {
  const requireUser = (): AuthUser => {
    const user = currentUser();
    if (!user) throw new UpstreamError('プロフィールの保存にはログインが必要です。');
    return user;
  };
  const nicknameOf = (input: string): string => {
    const nickname = normalizeNickname(input);
    if (!isValidNickname(nickname)) throw new UpstreamError(DENIED);
    return nickname;
  };

  return {
    name: 'firestore-profiles',

    async probe(): Promise<boolean> {
      return true;
    },

    watch(uid, onChange, onError): Unsubscribe {
      return onSnapshot(
        doc(db, 'users', uid),
        // 自分の保存直後は serverTimestamp が未確定なので、端末の時計で見積もった値を使う
        (snap) => onChange(snap.exists() ? toProfile(uid, snap.data({ serverTimestamps: 'estimate' })) : null),
        (e) => onError(toUpstream(e, 'プロフィールを読み込めませんでした。')),
      );
    },

    async register(input: string): Promise<void> {
      const user = requireUser();
      try {
        await setDoc(doc(db, 'users', user.uid), {
          nickname: nicknameOf(input),
          consentVersion: CONSENT_VERSION,
          agreedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        throw e instanceof UpstreamError ? e : toUpstream(e, DENIED);
      }
    },

    async rename(input: string): Promise<void> {
      const user = requireUser();
      try {
        await updateDoc(doc(db, 'users', user.uid), { nickname: nicknameOf(input), updatedAt: serverTimestamp() });
      } catch (e) {
        throw e instanceof UpstreamError ? e : toUpstream(e, DENIED);
      }
    },
  };
}
