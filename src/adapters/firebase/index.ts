/**
 * Firebase の各アダプタをまとめて作る入口。container はこのファイルだけを遅延 import する。
 */

import { getFirestore } from 'firebase/firestore';
import type { AuthPort, MarkerStorePort } from '@/ports';
import { firebaseApp } from './app';
import { FirebaseAuthAdapter } from './auth';
import { createMarkerStore } from './markerStore';

export interface FirebaseServices {
  auth: AuthPort;
  markerStore: MarkerStorePort;
}

/** セッションの復元を待ってから返す。 */
export async function createFirebaseServices(): Promise<FirebaseServices> {
  const auth = new FirebaseAuthAdapter();
  await auth.probe();
  const markerStore = createMarkerStore(getFirestore(firebaseApp()), () => auth.currentUser());
  return { auth, markerStore };
}
