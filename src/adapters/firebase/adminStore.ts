/**
 * Firestore の管理者向けの読み書き（rules/40-users.rules の admins・blacklist・users・nicknames・jobs。T27・T59）。
 * 権限はルールが守る。一般の利用者が呼ぶと permission-denied で UpstreamError になる。
 */

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { nicknameKey } from '@/core/logic/profile';
import type { EquipmentDef } from '@/core/types';
import type { AdminStorePort, AdminUserLists, AdminUserRow, AuthUser, EditedEquipment, JobRecord } from '@/ports';
import { UpstreamError } from '@/ports';
import { toUpstream } from './errors';

const ADMIN_ONLY = 'この操作は管理者だけができます。';
/** まとめて論理削除するときの 1 バッチの件数（ルールの get・exists は本番でバッチあたり 20 回まで） */
const DELETE_CHUNK = 3;
const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : 0);

export function createAdminStore(db: Firestore, currentUser: () => AuthUser | null): AdminStorePort {
  /** 自分の行があるか（admins・blacklist は本人の行だけ読める）。 */
  const hasOwnRow = async (collectionName: string, what: string): Promise<boolean> => {
    const user = currentUser();
    if (!user) return false;
    try {
      return (await getDoc(doc(db, collectionName, user.uid))).exists();
    } catch (e) {
      throw toUpstream(e, `${what}を確かめられませんでした。`);
    }
  };

  const guard = async <T>(task: () => Promise<T>): Promise<T> => {
    try {
      return await task();
    } catch (e) {
      throw e instanceof UpstreamError ? e : toUpstream(e, ADMIN_ONLY);
    }
  };

  return {
    name: 'firestore-admin',

    async probe(): Promise<boolean> {
      return true;
    },

    amIAdmin: () => hasOwnRow('admins', '管理者かどうか'),
    amIBlacklisted: () => hasOwnRow('blacklist', 'ログインできるかどうか'),

    jobs: () =>
      guard(async (): Promise<JobRecord[]> => {
        const snap = await getDocs(collection(db, 'jobs'));
        return snap.docs.map((d) => {
          const data = d.data();
          const values: Record<string, number> = {};
          for (const [k, v] of Object.entries(data)) if (typeof v === 'number') values[k] = v;
          return { id: d.id, ranAt: ms(data.ranAt), values };
        });
      }),

    users: () =>
      guard(async (): Promise<AdminUserLists> => {
        const [profiles, admins, blacklist] = await Promise.all(
          ['users', 'admins', 'blacklist'].map((name) => getDocs(collection(db, name))),
        );
        const byUid = new Map<string, AdminUserRow>(
          profiles.docs.map((d) => [d.id, { uid: d.id, nickname: String(d.data().nickname ?? ''), createdAt: ms(d.data().createdAt) }]),
        );
        const rowOf = (uid: string): AdminUserRow => byUid.get(uid) ?? { uid, nickname: null, createdAt: 0 };
        const adminIds = new Set(admins.docs.map((d) => d.id));
        const blackIds = new Set(blacklist.docs.map((d) => d.id));
        return {
          admins: [...adminIds].map(rowOf),
          users: [...byUid.values()]
            .filter((u) => !adminIds.has(u.uid) && !blackIds.has(u.uid))
            .sort((a, b) => b.createdAt - a.createdAt),
          blacklist: [...blackIds].map(rowOf),
        };
      }),

    deleteUser: (uid) =>
      guard(async () => {
        const nickname = (await getDoc(doc(db, 'users', uid))).data()?.nickname;
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', uid));
        // 公開プロフィール（チャンネル。T55）も消す
        batch.delete(doc(db, 'publicProfiles', uid));
        if (typeof nickname === 'string') {
          const index = doc(db, 'nicknames', nicknameKey(nickname));
          if ((await getDoc(index)).data()?.uid === uid) batch.delete(index);
        }
        await batch.commit();
      }),

    blacklist: (uid) =>
      guard(async () => {
        await setDoc(doc(db, 'blacklist', uid), { reason: '管理者画面から', createdAt: serverTimestamp() });
      }),

    unblacklist: (uid) =>
      guard(async () => {
        await deleteDoc(doc(db, 'blacklist', uid));
      }),

    softDeleteMarkers: (ids) =>
      guard(async () => {
        const alive: { id: string; videoId?: string }[] = [];
        for (const id of ids) {
          const data = (await getDoc(doc(db, 'markers', id))).data();
          if (data && data.deleted !== true) alive.push({ id, videoId: data.videoId as string | undefined });
        }
        for (let i = 0; i < alive.length; i += DELETE_CHUNK) {
          const batch = writeBatch(db);
          for (const m of alive.slice(i, i + DELETE_CHUNK)) {
            batch.update(doc(db, 'markers', m.id), { deleted: true, updatedAt: serverTimestamp() });
            if (!m.videoId) continue;
            const index = (await getDoc(doc(db, 'videos', m.videoId))).data();
            if (index?.markerId === m.id && index.blocked !== true) batch.delete(doc(db, 'videos', m.videoId));
          }
          await batch.commit();
        }
        return alive.length;
      }),

    withdrawRequest: (entry) =>
      guard(async () => {
        const budget = (await getDoc(doc(db, 'heatBudgets', entry.ownerUid))).data();
        const used = Number(budget?.used ?? 0);
        // 印が無い・使った熱量がこのリクエストより少ない行は、ルールが拒否する。送る前に理由の分かる形で止める
        if (!budget || used < entry.heat) {
          throw new UpstreamError(
            `リクエスト ${entry.id} は取り下げられません。持ち主の熱量の記録（${budget ? used : 'なし'}）が熱量 ${entry.heat} と合いません。`,
          );
        }
        const batch = writeBatch(db);
        batch.update(doc(db, 'requests', entry.id), { withdrawn: true, updatedAt: serverTimestamp() });
        batch.set(doc(db, 'heatBudgets', entry.ownerUid), { used: used - entry.heat, target: entry.id });
        await batch.commit();
      }),

    editedEquipment: () =>
      guard(async (): Promise<Record<string, EditedEquipment>> => {
        const snap = await getDocs(collection(db, 'equipmentMaster'));
        return Object.fromEntries(
          snap.docs.map((d) => [d.id, { makers: (d.data().makers ?? []) as EquipmentDef['makers'], updatedAt: ms(d.data().updatedAt) }]),
        );
      }),

    saveEquipment: (category, makers) =>
      guard(async () => {
        await setDoc(doc(db, 'equipmentMaster', category), { makers, updatedAt: serverTimestamp() });
      }),

  };
}
