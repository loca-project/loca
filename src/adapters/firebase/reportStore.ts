/**
 * Firestore への通報の書き込み（firestore.rules の「通報」）。
 * ID を「マーカー ID_uid」にして 1 人 1 マーカー 1 件にする。送る前に本人の通報があるかを読み、済みなら書かない。
 */

import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { AuthUser, ReportInput, ReportStorePort } from '@/ports';
import { UpstreamError } from '@/ports';
import { toUpstream } from './errors';

const DENIED = '通報が拒否されました。対象のマーカーが削除されていないか確認してください。';

export function createReportStore(db: Firestore, currentUser: () => AuthUser | null): ReportStorePort {
  return {
    name: 'firestore-reports',

    async probe(): Promise<boolean> {
      return true;
    },

    async submit(input: ReportInput): Promise<'created' | 'already'> {
      const user = currentUser();
      if (!user) throw new UpstreamError('通報するにはログインしてください。');
      const ref = doc(db, 'reports', `${input.markerId}_${user.uid}`);
      try {
        if ((await getDoc(ref)).exists()) return 'already';
        const detail = input.detail.trim();
        await setDoc(ref, {
          markerId: input.markerId,
          reporterUid: user.uid,
          reasons: input.reasons,
          ...(detail ? { detail } : {}),
          status: 'open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return 'created';
      } catch (e) {
        throw toUpstream(e, DENIED);
      }
    },
  };
}