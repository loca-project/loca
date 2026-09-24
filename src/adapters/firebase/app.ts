/**
 * Firebase アプリの初期化（ADR 0010）。
 * Firebase SDK を import してよいのは src/adapters/firebase/ だけ。
 * 設定値がそろっているかは呼び出し側（container）が canUseFirebase() で確かめてから読み込む。
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { appConfig } from '@/runtime/config';

export function firebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  const { apiKey, authDomain, projectId, appId } = appConfig.firebase;
  return initializeApp({ apiKey, authDomain, projectId, appId });
}
