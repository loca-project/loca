/**
 * Firestore へのマーカーの書き込み（ADR 0012）。
 *
 * ルールに合わせて、作成と本人の更新は必ず writeBatch で rateLimits/{uid} の印と一緒に書く。
 * 時刻はすべて serverTimestamp()。ルールが request.time と一致するかを検査する。
 *
 * Firestore のインスタンスとユーザーの取り出し方を外から受け取るのは、
 * エミュレータのテスト（tests/store/）で同じコードを動かすため。
 */

import { FirebaseError } from 'firebase/app';
import { collection, doc, serverTimestamp, writeBatch, type DocumentData, type Firestore } from 'firebase/firestore';
import type { MarkerContent } from '@/core/types';
import type { AuthUser, MarkerStorePort } from '@/ports';
import { UpstreamError } from '@/ports';

/** ルールの createdBy の上限（firestore.rules の reqString と揃える）。 */
const MAX_CREATED_BY = 100;

const MESSAGES: Record<string, string> = {
  'permission-denied':
    '保存が拒否されました。前回の保存から 6 秒以上あけてもう一度お試しください。本人以外のマーカーは変更できません。',
  unavailable: '通信に失敗しました。ネットワークを確認してください。',
  'resource-exhausted': '本日の保存の上限に達しました。日本時間の 16〜17 時以降にもう一度お試しください。',
};

/** Firestore は undefined を保存できないので、値の無い項目を落とす。 */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function toUpstream(e: unknown): UpstreamError {
  const code = e instanceof FirebaseError ? e.code : '';
  return new UpstreamError(MESSAGES[code] ?? `保存に失敗しました（${code || '不明なエラー'}）。`, e);
}

export function createMarkerStore(db: Firestore, currentUser: () => AuthUser | null): MarkerStorePort {
  const requireUser = (): AuthUser => {
    const user = currentUser();
    if (!user) throw new UpstreamError('保存するにはログインしてください。');
    return user;
  };

  /** 印とマーカーを同じバッチで書く。 */
  const commit = async (uid: string, markerId: string, data: DocumentData, mode: 'set' | 'update') => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'rateLimits', uid), { lastWriteAt: serverTimestamp(), target: markerId });
    const ref = doc(db, 'markers', markerId);
    if (mode === 'set') batch.set(ref, data);
    else batch.update(ref, data);
    try {
      await batch.commit();
    } catch (e) {
      throw toUpstream(e);
    }
  };

  return {
    name: 'firestore',

    async probe(): Promise<boolean> {
      return true;
    },

    async create(content: MarkerContent): Promise<string> {
      const user = requireUser();
      const id = doc(collection(db, 'markers')).id;
      await commit(user.uid, id, {
        ...defined(content),
        ownerUid: user.uid,
        createdBy: user.displayName.slice(0, MAX_CREATED_BY),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false,
      }, 'set');
      return id;
    },

    async update(id: string, patch: Partial<MarkerContent>): Promise<void> {
      const user = requireUser();
      await commit(user.uid, id, { ...defined(patch), updatedAt: serverTimestamp() }, 'update');
    },

    async softDelete(id: string): Promise<void> {
      const user = requireUser();
      await commit(user.uid, id, { deleted: true, updatedAt: serverTimestamp() }, 'update');
    },
  };
}
