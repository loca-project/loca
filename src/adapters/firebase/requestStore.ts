/**
 * Firestore への撮影リクエストの書き込み（firestore.rules の「撮影リクエスト」）。
 *
 * リクエストと heatBudgets/{uid}（使った熱量の合計と、このリクエストの ID）を同じバッチで書く。
 * 合計が 5 を超える・印と熱量が合わない書き込みはルールが拒否する。
 */

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { RequestContent, RequestEntry } from '@/core/types';
import { MAX_HEAT_PER_USER } from '@/core/types';
import type { AuthUser, RequestStorePort, Unsubscribe } from '@/ports';
import { UpstreamError } from '@/ports';
import { toUpstream } from './errors';

const DENIED = `保存が拒否されました。熱量は 1 人あたり合計 ${MAX_HEAT_PER_USER} までです。`;

function toEntry(id: string, data: DocumentData): RequestEntry {
  return {
    id,
    lat: data.lat,
    lng: data.lng,
    heat: data.heat,
    season: data.season ?? '',
    timeOfDay: data.timeOfDay ?? '',
    atmosphere: data.atmosphere ?? '',
    equipment: data.equipment,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0,
  };
}

export function createRequestStore(db: Firestore, currentUser: () => AuthUser | null): RequestStorePort {
  const usedBy = async (uid: string): Promise<number> => {
    try {
      const snap = await getDoc(doc(db, 'heatBudgets', uid));
      return snap.exists() ? Number(snap.data().used ?? 0) : 0;
    } catch (e) {
      throw toUpstream(e, '熱量の残りを確認できませんでした。');
    }
  };

  return {
    name: 'firestore-requests',

    async probe(): Promise<boolean> {
      return true;
    },

    async heatUsed(): Promise<number> {
      const user = currentUser();
      return user ? usedBy(user.uid) : 0;
    },

    async create(content: RequestContent): Promise<RequestEntry> {
      const user = currentUser();
      if (!user) throw new UpstreamError('リクエストするにはログインしてください。');
      const used = await usedBy(user.uid);
      if (used + content.heat > MAX_HEAT_PER_USER) {
        throw new UpstreamError(`熱量の上限を超えます。現在 ${used} / ${MAX_HEAT_PER_USER} を使っています。`);
      }

      const ref = doc(collection(db, 'requests'));
      const batch = writeBatch(db);
      batch.set(ref, {
        ...content,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'heatBudgets', user.uid), { used: used + content.heat, target: ref.id });
      try {
        await batch.commit();
      } catch (e) {
        throw toUpstream(e, DENIED);
      }
      return { ...content, id: ref.id, createdAt: Date.now() };
    },

    subscribeChanges(sinceMs, onChange, onError): Unsubscribe {
      // リクエストは作成後に変わらないので createdAt で絞る（単一項目の範囲条件）
      const added = query(collection(db, 'requests'), where('createdAt', '>', Timestamp.fromMillis(sinceMs)));
      return onSnapshot(
        added,
        (snap) => {
          const rows = snap
            .docChanges()
            .filter((c) => c.type === 'added')
            .map((c) => toEntry(c.doc.id, c.doc.data({ serverTimestamps: 'estimate' })));
          if (rows.length > 0) onChange(rows);
        },
        (e) => onError(toUpstream(e, DENIED)),
      );
    },
  };
}
