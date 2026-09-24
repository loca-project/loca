/**
 * サービス開始前の試験データを消す（本番の Firestore）。サービス開始後は使わない。
 *
 *   npm run data:reset                 消す件数を出すだけ（何も消さない）
 *   node scripts/reset-data.mjs --yes  実際に消す（取り消せない。project/ で実行する）
 *
 * --yes を npm 経由で渡さないこと。ルートからの委譲では npm 自身の --yes として解釈され、スクリプトに届かない。
 *
 * 消す: markers・videos・requests・heatBudgets・rateLimits・reports（利用者の投稿と、その索引・印・通報）。
 * 残す: admins・blacklist（運用の設定）。
 * 物理削除は差分の購読に届かないので、消したあとは同期で公開データを作り直す（ADR 0013）。
 *   gh workflow run sync-firestore.yml
 * 手順と確認は /reset-data。オーナーの権限（lib/owner-auth.mjs）で書く。
 */

import { FIRESTORE, PROJECT, call, ownerToken } from './lib/owner-auth.mjs';

const TARGETS = ['markers', 'videos', 'requests', 'heatBudgets', 'rateLimits', 'reports'];
const EXECUTE = process.argv.includes('--yes');
const DATABASE = `projects/${PROJECT}/databases/(default)`;

const { token } = await ownerToken();

async function listNames(collection) {
  const names = [];
  let pageToken = '';
  do {
    const q = `pageSize=300&mask.fieldPaths=__name__${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const body = await call(token, 'GET', `${FIRESTORE}/${collection}?${q}`);
    names.push(...(body?.documents ?? []).map((d) => d.name));
    pageToken = body?.nextPageToken ?? '';
  } while (pageToken);
  return names;
}

let total = 0;
for (const collection of TARGETS) {
  const names = await listNames(collection);
  total += names.length;
  console.log(`${collection.padEnd(12)} ${names.length} 件`);
  if (!EXECUTE) continue;
  // 1 回のコミットは 500 件まで
  for (let i = 0; i < names.length; i += 500) {
    const writes = names.slice(i, i + 500).map((name) => ({ delete: name }));
    await call(token, 'POST', `https://firestore.googleapis.com/v1/${DATABASE}/documents:commit`, { writes });
  }
}

if (!EXECUTE) {
  console.log(`\n合計 ${total} 件（まだ何も消していません。消すには project/ で node scripts/reset-data.mjs --yes）`);
} else {
  const left = (await Promise.all(TARGETS.map(listNames))).reduce((sum, n) => sum + n.length, 0);
  console.log(`\nOK  ${total} 件を消しました（残り ${left} 件）。続けて同期で公開データを作り直してください。`);
  if (left > 0) process.exit(1);
}
