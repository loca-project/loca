/**
 * Firebase CLI にログイン中のアカウント（プロジェクトのオーナー）のアクセストークンで REST API を呼ぶ。
 * この経路はセキュリティルールを通らず、IAM で判定される。管理用のスクリプトだけが使う。
 * CLI のログインが切れていたら /firebase-rules の手順 2 でログインし直す。
 */

import { createRequire } from 'node:module';

export const PROJECT = 'loca-d3792';
export const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

export function fail(message, code = 1) {
  console.error(`NG: ${message}`);
  process.exit(code);
}

/** アクセストークンと、ログイン中のメールアドレス（記録用）。値は出力しない。 */
export async function ownerToken() {
  const require = createRequire(import.meta.url);
  const auth = require('firebase-tools/lib/auth');
  const account = auth.getGlobalDefaultAccount();
  const refresh = account?.tokens?.refresh_token;
  if (!refresh) fail('Firebase CLI にログインしていません。/firebase-rules の手順 2 でログインしてください。', 2);
  try {
    return { token: (await auth.getAccessToken(refresh, SCOPES)).access_token, email: account.user?.email };
  } catch {
    return fail('Firebase CLI のログインが切れています。/firebase-rules の手順 2 でログインし直してください。', 2);
  }
}

/** REST を呼ぶ。404 は null を返し、それ以外の失敗は止める。 */
export async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) fail(`${method} ${url.replace(/\?.*/, '')} が ${res.status} を返しました: ${await res.text()}`);
  return res.json();
}
