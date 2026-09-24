/**
 * Firestore への撮影リクエストの書き込み（firestore.rules の「撮影リクエスト」）。
 *
 * リクエストと heatBudgets/{uid}（使った熱量の合計と、このリクエストの ID）を同じバッチで書く。
 * 合計が 5 を超える・印と熱量が合わない書き込みはルールが拒否する。取り下げも同じで、印を減らして熱量を戻す。
 * 取り下げは論理削除（withdrawn: true と updatedAt の更新）。物理削除すると、同期より前に作られた行の
 * 取り下げが差分の購読に届かず、次の同期まで古い姿が残るため（ADR 0013）。
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
    // 未選択の項目は持たない（ルールが一覧のキーだけを許している）
    ...(data.season ? { season: data.season } : {}),
    ...(data.timeOfDay ? { timeOfDay: data.timeOfDay } : {}),
    ...(data.style ? { style: data.style } : {}),
    equipment: data.equipment,
    ownerUid: data.ownerUid ?? '',
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
      // Firestore は undefined を保存できないので、未選択の項目を落とす
      const stored = Object.fromEntries(Object.entries(content).filter(([, v]) => v !== undefined));
      batch.set(ref, {
        ...stored,
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
      return { ...content, id: ref.id, ownerUid: user.uid, createdAt: Date.now() };
    },

    async withdraw(entry): Promise<void> {
      const user = currentUser();
      if (!user) throw new UpstreamError('取り下げるにはログインしてください。');
      const used = await usedBy(user.uid);
      const batch = writeBatch(db);
      batch.update(doc(db, 'requests', entry.id), { withdrawn: true, updatedAt: serverTimestamp() });
      batch.set(doc(db, 'heatBudgets', user.uid), { used: Math.max(0, used - entry.heat), target: entry.id });
      try {
        await batch.commit();
      } catch (e) {
        throw toUpstream(e, '取り下げが拒否されました。本人のリクエストだけを取り下げられます。');
      }
    },

    subscribeChanges(sinceMs, onChange, onError): Unsubscribe {
      // マーカーと同じく updatedAt で絞る。作成も取り下げも updatedAt を進めるので、同期より前に作られた行の取り下げも届く
      const changed = query(collection(db, 'requests'), where('updatedAt', '>', Timestamp.fromMillis(sinceMs)));
      return onSnapshot(
        changed,
        (snap) => {
          const rows = snap
            .docChanges()
            .filter((c) => c.type !== 'removed')
            .map((c) => ({ id: c.doc.id, data: c.doc.data({ serverTimestamps: 'estimate' }) }));
          const added = rows.filter((r) => r.data.withdrawn !== true).map((r) => toEntry(r.id, r.data));
          const removed = rows.filter((r) => r.data.withdrawn === true).map((r) => r.id);
          if (added.length > 0 || removed.length > 0) onChange(added, removed);
        },
        (e) => onError(toUpstream(e, DENIED)),
      );
    },
  };
}
