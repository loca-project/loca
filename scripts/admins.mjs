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

import { FIRESTORE, PROJECT, call, fail, ownerToken } from './lib/owner-auth.mjs';

const IDENTITY = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`;

/** メールアドレスなら uid に引く。uid ならそのまま返す。 */
async function resolveUid(token, target) {
  if (!target.includes('@')) return { uid: target, email: '' };
  const found = await call(token, 'POST', IDENTITY, { email: [target] });
  const user = found?.users?.[0];
  if (!user) fail(`${target} のユーザーが Firebase Auth にいません。先にサイトへ一度ログインしてもらってください。`);
  return { uid: user.localId, email: target };
}

const [command, target] = process.argv.slice(2);
const { token, email: operator } = await ownerToken();

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
