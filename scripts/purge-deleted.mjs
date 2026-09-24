/**
 * 論理削除・取り下げから 30 日たった行と動画の索引を物理削除する（ADR 0021・T58）。
 * 毎晩の sync-firestore.yml が、公開データを作り直したあとに呼ぶ。
 *
 *   node scripts/purge-deleted.mjs            消す
 *   node scripts/purge-deleted.mjs --dry-run  計画だけ出して消さない（手元では Firebase CLI のログインで読む）
 *
 * 環境変数（Actions）: GOOGLE_ACCESS_TOKEN（Workload Identity 連携）、GCP_PROJECT。
 * 無ければオーナーのログイン（lib/owner-auth.mjs）を使う。IAM の経路なのでルールは通らない。
 *
 * 守ること:
 * - 公開データ（public/data）の syncedAt より後に消された行は消さない（計画は lib/purge-plan.mjs）
 * - 読んだあとに変わった行（管理者の復元など）は消さない（updateTime の前提条件）
 * - 実行の記録を jobs/purge-deleted に残す（管理者だけが読める）
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fromFields } from './lib/firestore-rest.mjs';
import { planPurge } from './lib/purge-plan.mjs';
import { writeSummary } from './lib/summary.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

async function credentials() {
  const { GOOGLE_ACCESS_TOKEN, GCP_PROJECT } = process.env;
  if (GOOGLE_ACCESS_TOKEN && GCP_PROJECT) return { token: GOOGLE_ACCESS_TOKEN, project: GCP_PROJECT };
  // 手元での確認用。firebase-tools は Actions の同期ジョブには入れていないので、使うときだけ読み込む
  const { ownerToken, PROJECT } = await import('./lib/owner-auth.mjs');
  return { token: (await ownerToken()).token, project: PROJECT };
}

const { token, project } = await credentials();
const DB = `projects/${project}/databases/(default)`;
const API = `https://firestore.googleapis.com/v1/${DB}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function mustOk(res, what) {
  if (!res.ok) {
    console.error(`NG: ${what} が HTTP ${res.status} を返しました: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  return res.json();
}

/** コレクションの必要な項目だけを全件読む。updateTime は削除の前提条件に使う。 */
async function list(collection, fields) {
  const rows = [];
  let pageToken = '';
  do {
    const url = new URL(`${API}/documents/${collection}`);
    url.searchParams.set('pageSize', '300');
    for (const f of fields) url.searchParams.append('mask.fieldPaths', f);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const body = await mustOk(await fetch(url, { headers }), `${collection} の読み出し`);
    for (const doc of body.documents ?? []) {
      rows.push({ id: doc.name.split('/').pop(), updateTime: doc.updateTime, ...fromFields(doc.fields ?? {}) });
    }
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return rows;
}

/** 公開データの syncedAt（markers と requests の早いほう）。 */
async function publishedSyncedAt() {
  const read = async (file) => JSON.parse(await readFile(path.join(process.cwd(), 'public', 'data', file), 'utf8')).syncedAt;
  return Math.min(Number(await read('markers.json')), Number(await read('requests.json')));
}

const [markers, requests, videos, syncedAt] = await Promise.all([
  list('markers', ['deleted', 'updatedAt', 'videoId']),
  list('requests', ['withdrawn', 'updatedAt']),
  list('videos', ['markerId', 'blocked']),
  publishedSyncedAt(),
]);
const plan = planPurge({ markers, requests, videos, now: Date.now(), syncedAt });

console.log(`基準: ${new Date(plan.cutoff).toISOString()} より前に論理削除・取り下げされた行`);
console.log(`マーカー ${plan.markerIds.length} / ${markers.length} 件・リクエスト ${plan.requestIds.length} / ${requests.length} 件・動画の索引 ${plan.videoIds.length} / ${videos.length} 件を消す`);
// Actions のジョブ概要に件数を出す（T31）
writeSummary(DRY_RUN ? '30 日たった行の物理削除（計画だけ）' : '30 日たった行の物理削除', [
  ['基準（これより前に論理削除）', new Date(plan.cutoff).toISOString()],
  ['マーカー', `${plan.markerIds.length} / ${markers.length} 件`],
  ['撮影リクエスト', `${plan.requestIds.length} / ${requests.length} 件`],
  ['動画の索引', `${plan.videoIds.length} / ${videos.length} 件`],
]);
if (DRY_RUN) {
  console.log('--dry-run のため消しません');
  process.exit(0);
}

const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
const docName = (collection, id) => `${DB}/documents/${collection}/${id}`;
/** 読んだときから変わっていなければ消す。 */
const remove = (collection, row) => ({ delete: docName(collection, row.id), currentDocument: { updateTime: row.updateTime } });

const markerRows = byId(markers);
const requestRows = byId(requests);
const videoRows = byId(videos);
const writes = [
  ...plan.markerIds.map((id) => remove('markers', markerRows.get(id))),
  ...plan.requestIds.map((id) => remove('requests', requestRows.get(id))),
  ...plan.videoIds.map((id) => remove('videos', videoRows.get(id))),
];
const summary = { markers: plan.markerIds.length, requests: plan.requestIds.length, videos: plan.videoIds.length };
writes.push({
  update: {
    name: docName('jobs', 'purge-deleted'),
    fields: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { integerValue: String(v) }])),
  },
  updateTransforms: [{ fieldPath: 'ranAt', setToServerValue: 'REQUEST_TIME' }],
});

// 500 件ずつ書く（commit の上限）
for (let i = 0; i < writes.length; i += 500) {
  await mustOk(
    await fetch(`${API}/documents:commit`, { method: 'POST', headers, body: JSON.stringify({ writes: writes.slice(i, i + 500) }) }),
    'Firestore への書き込み',
  );
}
console.log('OK  消しました（jobs/purge-deleted に記録）');
