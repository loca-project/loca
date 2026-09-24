/**
 * Firebase の各アダプタをまとめて作る入口。container はこのファイルだけを遅延 import する。
 */

import { getFirestore } from 'firebase/firestore';
import type { AuthPort, MarkerStorePort, ProfileStorePort, ReportStorePort, RequestStorePort } from '@/ports';
import { firebaseApp } from './app';
import { FirebaseAuthAdapter } from './auth';
import { createMarkerStore } from './markerStore';
import { createRequestStore } from './requestStore';
import { createReportStore } from './reportStore';
import { createProfileStore } from './profileStore';

export interface FirebaseServices {
  auth: AuthPort;
  markerStore: MarkerStorePort;
  requestStore: RequestStorePort;
  reportStore: ReportStorePort;
  profileStore: ProfileStorePort;
}

/** セッションの復元を待ってから返す。 */
export async function createFirebaseServices(): Promise<FirebaseServices> {
  const auth = new FirebaseAuthAdapter();
  await auth.probe();
  const db = getFirestore(firebaseApp());
  const user = () => auth.currentUser();
  return {
    auth,
    markerStore: createMarkerStore(db, user),
    requestStore: createRequestStore(db, user),
    reportStore: createReportStore(db, user),
    profileStore: createProfileStore(db, user),
  };
}
