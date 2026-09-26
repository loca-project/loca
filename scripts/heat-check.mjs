/**
 * 本番の撮影リクエストと熱量の記録（heatBudgets）の食い違いを数える。読むだけ（T70）。
 *
 *   npm run heat:check
 *
 * 持ち主ごとに「取り下げていないリクエストの熱量の合計」と heatBudgets/{uid}.used を比べる。
 * 合わない持ち主は、ルール（rules/20-requests.rules の validBudget）が差分の一致を求めるため、
 * 管理者でも取り下げられないことがある。uid は先頭 6 文字だけを出す。
 * 終了コード: 0 = 食い違いなし、3 = 食い違いあり。
 * Firebase CLI にログイン中のオーナーの権限で REST を呼ぶ（lib/owner-auth.mjs）。ルールは通らない。
 */

import { FIRESTORE, call, ownerToken } from './lib/owner-auth.mjs';
import { fromFields } from './lib/firestore-rest.mjs';

const { token } = await ownerToken();

/** コレクションを全件読む（ページ送りあり）。 */
async function list(collection) {
  const rows = [];
  let pageToken = '';
  do {
    const body = await call(token, 'GET', `${FIRESTORE}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const d of body?.documents ?? []) rows.push({ id: d.name.split('/').pop(), ...fromFields(d.fields ?? {}) });
    pageToken = body?.nextPageToken ?? '';
  } while (pageToken);
  return rows;
}

const [requests, budgets] = await Promise.all([list('requests'), list('heatBudgets')]);

// 持ち主ごとの、取り下げていないリクエストの熱量の合計と件数
const alive = new Map();
for (const r of requests) {
  if (r.withdrawn === true) continue;
  const now = alive.get(r.ownerUid) ?? { heat: 0, count: 0 };
  alive.set(r.ownerUid, { heat: now.heat + Number(r.heat), count: now.count + 1 });
}
const used = new Map(budgets.map((b) => [b.id, Number(b.used)]));

const owners = [...new Set([...alive.keys(), ...used.keys()])];
const rows = owners.map((uid) => ({
  uid: `${String(uid).slice(0, 6)}…`,
  alive: alive.get(uid)?.heat ?? 0,
  count: alive.get(uid)?.count ?? 0,
  used: used.has(uid) ? used.get(uid) : null,
}));
const mismatched = rows.filter((r) => r.alive !== (r.used ?? 0));

console.log(`リクエスト ${requests.length} 件（取り下げていないもの ${[...alive.values()].reduce((s, a) => s + a.count, 0)} 件）・heatBudgets ${budgets.length} 件`);
console.log(`持ち主 ${owners.length} 人中、食い違い ${mismatched.length} 人`);
for (const r of mismatched) {
  const kind = r.used === null ? '記録なし' : r.alive > r.used ? '記録が少ない' : '記録が多い';
  console.log(`  ${r.uid}  取り下げていない熱量 ${r.alive}（${r.count} 件）・used ${r.used ?? '—'}  ${kind}`);
}
process.exit(mismatched.length ? 3 : 0);
