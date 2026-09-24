/**
 * 本番の利用者の一覧（プロフィール・最後のログイン・管理者・ブラックリスト）。読むだけ。
 *
 *   npm run admin:accounts
 *
 * 「管理者モードが出ない」「ログインできない」の切り分けに使う（別のアカウントでログインしていることが多い）。
 * メールアドレスは先頭 2 文字とドメインだけ出す（値を応答・ログに出さない。プロジェクトポリシー）。
 * Firebase CLI にログイン中のオーナーの権限で REST を呼ぶ（lib/owner-auth.mjs）。ルールは通らない。
 */

import { FIRESTORE, PROJECT, call, ownerToken } from './lib/owner-auth.mjs';

const { token } = await ownerToken();

/** コレクションの文書 ID と中身（ページ送りあり）。 */
async function list(collection) {
  const docs = [];
  let pageToken = '';
  do {
    const body = await call(token, 'GET', `${FIRESTORE}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
    docs.push(...(body?.documents ?? []));
    pageToken = body?.nextPageToken ?? '';
  } while (pageToken);
  return docs.map((d) => ({ id: d.name.split('/').pop(), fields: d.fields ?? {} }));
}

const [users, admins, blacklist] = await Promise.all(['users', 'admins', 'blacklist'].map(list));
const adminIds = new Set(admins.map((d) => d.id));
const blackIds = new Set(blacklist.map((d) => d.id));
const uids = [...new Set([...users.map((u) => u.id), ...adminIds, ...blackIds])];

// Firebase Auth の利用者（最後のログインとメール）。100 件ずつ引く
const accounts = new Map();
for (let i = 0; i < uids.length; i += 100) {
  const found = await call(token, 'POST', `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
    localId: uids.slice(i, i + 100),
  });
  for (const u of found?.users ?? []) accounts.set(u.localId, u);
}

const mask = (email) => (email ? `${email.slice(0, 2)}***@${email.split('@')[1]}` : '-');
const time = (ms) => (ms ? new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 16) : '-');
const rows = uids
  .map((uid) => {
    const a = accounts.get(uid);
    return {
      uid,
      nickname: users.find((u) => u.id === uid)?.fields.nickname?.stringValue ?? '（プロフィールなし）',
      email: mask(a?.email),
      lastLogin: Number(a?.lastLoginAt ?? 0),
      role: [adminIds.has(uid) && '管理者', blackIds.has(uid) && 'ブラックリスト', !a && 'ログインの登録なし'].filter(Boolean).join('・') || '-',
    };
  })
  .sort((x, y) => y.lastLogin - x.lastLogin);

console.log('最後のログイン（UTC）\tuid\tニックネーム\tメール\t区分');
for (const r of rows) console.log(`${time(r.lastLogin)}\t${r.uid.slice(0, 8)}…\t${r.nickname}\t${r.email}\t${r.role}`);
console.log(`\n利用者 ${rows.length} 人（プロフィール ${users.length}・管理者 ${adminIds.size}・ブラックリスト ${blackIds.size}。${PROJECT}）`);
