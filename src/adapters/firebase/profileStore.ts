/**
 * Firestore へのプロフィールの読み書き（rules/40-users.rules・ADR 0019）。
 * users/{uid} に、ニックネームと同意の版・日時だけを持つ。時刻はすべて serverTimestamp()。
 * ニックネームを変えたら、本人のマーカーの投稿者名（createdBy）も同じ名前にそろえる（決定 7）。
 */

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { UserProfile } from '@/core/types';
import { CONSENT_VERSION, isValidNickname, nicknameKey, normalizeNickname } from '@/core/logic/profile';
import type { AuthUser, ProfileStorePort, Unsubscribe } from '@/ports';
import { UpstreamError } from '@/ports';
import { toUpstream } from './errors';

const DENIED = 'プロフィールを保存できませんでした。ニックネームは 1〜20 字で、改行と「/」を含めないでください。';
const RENAME_DENIED = 'ニックネームを変えられませんでした。前の登録・変更から 1 分あけてもう一度お試しください。';
const TAKEN = 'このニックネームはほかの人が使っています。別の名前にしてください（大文字と小文字の違いは同じ名前とみなします）。';
const TAKEN_BY_OTHER = 'いまのニックネームはほかの人も使っています。プロフィールから別の名前に変えてください。';
const ALIGN_DENIED = '投稿者名をニックネームにそろえられませんでした。再読み込みすると、もう一度そろえます。';

/** 1 回のバッチでそろえるマーカーの数。ルールの get・exists は本番でバッチあたり 20 回まで（同じ文書の数え方は未確認）なので、1 件 3 回と見ても収まる数にする */
const ALIGN_CHUNK = 5;

/**
 * 本人のマーカーのうち投稿者名が nickname と違うものを、createdBy と updatedAt だけの更新でそろえる。
 * updatedAt を進めるので、地図を開いている人にも差分の購読で届く（ADR 0013）。
 * そろえた件数を返す。
 */
async function alignAuthor(db: Firestore, uid: string, nickname: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'markers'), where('ownerUid', '==', uid)));
  const stale = snap.docs.filter((d) => d.data().createdBy !== nickname);
  for (let i = 0; i < stale.length; i += ALIGN_CHUNK) {
    const batch = writeBatch(db);
    stale
      .slice(i, i + ALIGN_CHUNK)
      .forEach((d) => batch.update(d.ref, { createdBy: nickname, updatedAt: serverTimestamp() }));
    await batch.commit();
  }
  return stale.length;
}

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
  const indexRef = (nickname: string) => doc(db, 'nicknames', nicknameKey(nickname));
  /** その名前を持っている人の uid。だれも持っていなければ null。 */
  const holderOf = async (nickname: string): Promise<string | null> => {
    const uid = (await getDoc(indexRef(nickname))).data()?.uid;
    return typeof uid === 'string' ? uid : null;
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
      const nickname = nicknameOf(input);
      try {
        if ((await holderOf(nickname)) !== null) throw new UpstreamError(TAKEN);
        // プロフィールと名前の索引を同じバッチで作る（ルールが両方そろうことを求める）
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', user.uid), {
          nickname,
          consentVersion: CONSENT_VERSION,
          agreedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(indexRef(nickname), { uid: user.uid });
        await batch.commit();
      } catch (e) {
        throw e instanceof UpstreamError ? e : toUpstream(e, DENIED);
      }
    },

    async rename(input: string): Promise<void> {
      const user = requireUser();
      const nickname = nicknameOf(input);
      try {
        const holder = await holderOf(nickname);
        if (holder !== null && holder !== user.uid) throw new UpstreamError(TAKEN);
        const before = (await getDoc(doc(db, 'users', user.uid))).data()?.nickname;
        // プロフィールの変更・新しい名前の索引・古い名前の索引の手放しを同じバッチで書く
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', user.uid), { nickname, updatedAt: serverTimestamp() });
        if (holder === null) batch.set(indexRef(nickname), { uid: user.uid });
        if (typeof before === 'string' && nicknameKey(before) !== nicknameKey(nickname)) {
          if ((await holderOf(before)) === user.uid) batch.delete(indexRef(before));
        }
        await batch.commit();
      } catch (e) {
        throw e instanceof UpstreamError ? e : toUpstream(e, RENAME_DENIED);
      }
      // マーカーの投稿者名は後続のバッチで。途中で失敗してもログイン時の repair がそろえる
      try {
        await alignAuthor(db, user.uid, nickname);
      } catch (e) {
        throw toUpstream(e, ALIGN_DENIED);
      }
    },

    async repair(nickname: string): Promise<number> {
      const user = requireUser();
      try {
        // 重複の禁止より前に登録した人は索引を持たないので、いまの名前で取る
        const holder = await holderOf(nickname);
        if (holder === null) await setDoc(indexRef(nickname), { uid: user.uid });
        else if (holder !== user.uid) throw new UpstreamError(TAKEN_BY_OTHER);
        return await alignAuthor(db, user.uid, nickname);
      } catch (e) {
        throw e instanceof UpstreamError ? e : toUpstream(e, ALIGN_DENIED);
      }
    },
  };
}
