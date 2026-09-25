/**
 * 本番の Firestore を、Firebase CLI にログイン中のオーナーの権限（IAM）で読む。書き込みはしない。
 * ルールで本人しか読めない文書（heatBudgets・users・admins など）の確認と、
 * 本番で索引が要る問い合わせかどうかの確認に使う（エミュレータは索引を見ないため。2026-09-25 に T82 で本番だけ落ちた）。
 *
 *   npm run fs:read -- get <コレクション>/<ID>
 *   npm run fs:read -- list <コレクション> [--where 項目==値] [--sum 項目,項目] [--limit 20]
 *
 * uid・メールに当たる値は先頭 6 文字だけを出す（ログやノートに残さないため）。
 * --sum を付けると集計の問い合わせ（runAggregationQuery）にする。索引が要れば「NG: 索引が要る」と出して終了コード 3。
 */

import { FIRESTORE, call, ownerToken } from './lib/owner-auth.mjs';
import { fromFields } from './lib/firestore-rest.mjs';

const [mode, target, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (!['get', 'list'].includes(mode) || !target) {
  console.error('使い方: npm run fs:read -- get <コレクション>/<ID> ｜ list <コレクション> [--where 項目==値] [--sum 項目,…] [--limit n]');
  process.exit(2);
}

/** uid・メールらしい値を伏せる（28 字前後の英数字の ID、@ を含む値、名前が Uid・email で終わる項目）。 */
const mask = (key, value) => {
  if (typeof value !== 'string') return value;
  if (/(uid|Uid|email)$/.test(key) || value.includes('@') && value.includes('.')) return `${value.slice(0, 6)}…`;
  return value;
};
const show = (id, fields) => {
  const data = Object.fromEntries(Object.entries(fromFields(fields ?? {})).map(([k, v]) => [k, mask(k, v)]));
  console.log(`${id.length >= 20 ? `${id.slice(0, 6)}…` : id}  ${JSON.stringify(data)}`);
};

const { token } = await ownerToken();

if (mode === 'get') {
  const doc = await call(token, 'GET', `${FIRESTORE}/${target}`);
  if (!doc) {
    console.log(`${target}: 無い`);
    process.exit(0);
  }
  show(target.split('/').pop(), doc.fields);
  process.exit(0);
}

// list: 条件と集計は runQuery / runAggregationQuery（索引が要るかどうかも本番の答えで分かる）
const where = opt('where');
const structuredQuery = { from: [{ collectionId: target }], limit: Number(opt('limit') ?? 20) };
if (where) {
  const [field, raw] = where.split('==');
  const value = /^-?\d+$/.test(raw) ? { integerValue: raw } : raw === 'true' || raw === 'false' ? { booleanValue: raw === 'true' } : { stringValue: raw };
  structuredQuery.where = { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value } };
}
const sums = opt('sum')?.split(',').filter(Boolean) ?? [];
const url = `${FIRESTORE}:${sums.length ? 'runAggregationQuery' : 'runQuery'}`;
const body = sums.length
  ? { structuredAggregationQuery: { structuredQuery: { ...structuredQuery, limit: undefined }, aggregations: sums.map((f) => ({ alias: f, sum: { field: { fieldPath: f } } })) } }
  : { structuredQuery };
const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const text = await res.text();
if (!res.ok) {
  const needsIndex = /requires an index/i.test(text);
  console.error(needsIndex ? 'NG: 索引が要る（firestore.indexes.json に足して npm run deploy:rules）' : `NG: HTTP ${res.status} ${text.slice(0, 200)}`);
  process.exit(needsIndex ? 3 : 1);
}
const rows = JSON.parse(text);
if (sums.length) {
  console.log(`集計: ${JSON.stringify(Object.fromEntries(Object.entries(rows[0]?.result?.aggregateFields ?? {}).map(([k, v]) => [k, Number(Object.values(v)[0])])))}`);
} else {
  const docs = rows.filter((r) => r.document);
  docs.forEach((r) => show(r.document.name.split('/').pop(), r.document.fields));
  console.log(`${docs.length} 件（上限 ${structuredQuery.limit}）`);
}
