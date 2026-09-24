/**
 * Firestore の管理者向けの読み出し（rules/40-users.rules の admins・jobs。T27）。
 */

import { Timestamp, collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore';
import type { AdminStorePort, AuthUser, JobRecord } from '@/ports';
import { toUpstream } from './errors';

export function createAdminStore(db: Firestore, currentUser: () => AuthUser | null): AdminStorePort {
  return {
    name: 'firestore-admin',

    async probe(): Promise<boolean> {
      return true;
    },

    async amIAdmin(): Promise<boolean> {
      const user = currentUser();
      if (!user) return false;
      try {
        return (await getDoc(doc(db, 'admins', user.uid))).exists();
      } catch (e) {
        throw toUpstream(e, '管理者かどうかを確かめられませんでした。');
      }
    },

    async jobs(): Promise<JobRecord[]> {
      try {
        const snap = await getDocs(collection(db, 'jobs'));
        return snap.docs.map((d) => {
          const data = d.data();
          const values: Record<string, number> = {};
          for (const [k, v] of Object.entries(data)) if (typeof v === 'number') values[k] = v;
          return { id: d.id, ranAt: data.ranAt instanceof Timestamp ? data.ranAt.toMillis() : 0, values };
        });
      } catch (e) {
        throw toUpstream(e, '定期処理の記録は管理者だけが読めます。');
      }
    },
  };
}
