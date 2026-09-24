/**
 * 管理者（Firestore の admins/{uid}）を足す・一覧する・外す。
 *
 *   npm run admin:list
 *   npm run admin:add <メールアドレスか uid>
 *   npm run admin:remove <メールアドレスか uid>
 *
 * ルールでは最初の管理者を誰も作れない（ADR 0012）。ここでは Firebase CLI にログイン中のアカウント
 * （プロジェクトのオーナー）の権限で REST API を呼ぶ。この経路はセキュリティルールを通らず、IAM で判定される。
 * CLI のログインが切れていたら /firebase-rules の手順 2 でログインし直す。
 *
 * メールアドレスは Firebase Auth（Identity Toolkit）で uid に引く。サイトに一度もログインしていない人は引けない。
 */

import { createRequire } from 'node:module';

const PROJECT = 'loca-d3792';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const IDENTITY = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`;
const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

function fail(message, code = 1) {
  console.error(`NG: ${message}`);
  process.exit(code);
}

/** Firebase CLI のログイン情報からアクセストークンを得る（値は出力しない）。 */
async function accessToken() {
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

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) fail(`${method} ${url.replace(/\?.*/, '')} が ${res.status} を返しました: ${await res.text()}`);
  return res.status === 404 ? null : res.json();
}

/** メールアドレスなら uid に引く。uid ならそのまま返す。 */
async function resolveUid(token, target) {
  if (!target.includes('@')) return { uid: target, email: '' };
  const found = await call(token, 'POST', IDENTITY, { email: [target] });
  const user = found?.users?.[0];
  if (!user) fail(`${target} のユーザーが Firebase Auth にいません。先にサイトへ一度ログインしてもらってください。`);
  return { uid: user.localId, email: target };
}

const [command, target] = process.argv.slice(2);
const { token, email: operator } = await accessToken();

if (command === 'list') {
  const body = await call(token, 'GET', `${FIRESTORE}/admins?pageSize=300`);
  const docs = body?.documents ?? [];
  for (const d of docs) console.log(`${d.name.split('/').pop()}  ${d.fields?.note?.stringValue ?? ''}`);
  console.log(`\n管理者 ${docs.length} 人（${PROJECT}）`);
} else if (command === 'add' && target) {
  const { uid, email } = await resolveUid(token, target);
  const note = `${email || uid} を ${operator ?? 'Firebase CLI'} が追加`;
  await call(token, 'PATCH', `${FIRESTORE}/admins/${uid}`, {
    fields: { note: { stringValue: note }, addedAt: { timestampValue: new Date().toISOString() } },
  });
  console.log(`OK  管理者に追加しました: ${uid}${email ? `（${email}）` : ''}`);
} else if (command === 'remove' && target) {
  const { uid } = await resolveUid(token, target);
  await call(token, 'DELETE', `${FIRESTORE}/admins/${uid}`);
  console.log(`OK  管理者から外しました: ${uid}`);
} else {
  fail('使い方: npm run admin:list / admin:add <メールか uid> / admin:remove <メールか uid>', 2);
}
