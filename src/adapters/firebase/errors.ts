/** Firestore の失敗を、利用者に見せる日本語の UpstreamError にする。 */

import { FirebaseError } from 'firebase/app';
import { UpstreamError } from '@/ports';

const COMMON: Record<string, string> = {
  unavailable: '通信に失敗しました。ネットワークを確認してください。',
  'resource-exhausted': '本日の保存の上限に達しました。日本時間の 16〜17 時以降にもう一度お試しください。',
};

/** permissionDenied は操作ごとに理由が違うので呼び出し側が渡す。 */
export function toUpstream(e: unknown, permissionDenied: string): UpstreamError {
  const code = e instanceof FirebaseError ? e.code : '';
  const message = code === 'permission-denied' ? permissionDenied : COMMON[code];
  return new UpstreamError(message ?? `保存に失敗しました（${code || '不明なエラー'}）。`, e);
}
