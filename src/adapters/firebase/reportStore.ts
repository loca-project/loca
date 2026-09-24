/**
 * Firestore への通報の書き込み（firestore.rules の「通報」）。
 * ID を「マーカー ID_uid」にして 1 人 1 マーカー 1 件にし、件数を通報した人数として数えられるようにする。
 * 同じ人の 2 回目は、理由と詳細を置き換えて確認待ちに戻す。
 */

import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { ReportRecord, ReportSummary } from '@/core/types';
import { summarizeReports } from '@/core/logic/reports';
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

    async submit(input: ReportInput): Promise<'created' | 'updated'> {
      const user = currentUser();
      if (!user) throw new UpstreamError('通報するにはログインしてください。');
      const ref = doc(db, 'reports', `${input.markerId}_${user.uid}`);
      const detail = input.detail.trim();
      try {
        if ((await getDoc(ref)).exists()) {
          // 2 回目: 理由と詳細を置き換える。詳細を空にしたら項目ごと消す
          await updateDoc(ref, {
            reasons: input.reasons,
            detail: detail ? detail : deleteField(),
            status: 'open',
            updatedAt: serverTimestamp(),
          });
          return 'updated';
        }
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

    async summaries(): Promise<ReportSummary[]> {
      try {
        const snap = await getDocs(collection(db, 'reports'));
        const records: ReportRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            markerId: data.markerId,
            reporterUid: data.reporterUid,
            reasons: data.reasons ?? [],
            status: data.status === 'open' ? 'open' : 'resolved',
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0,
          };
        });
        return summarizeReports(records);
      } catch (e) {
        throw toUpstream(e, '通報の集計は管理者だけが読めます。');
      }
    },
  };
}
