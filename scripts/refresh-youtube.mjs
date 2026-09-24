/**
 * マーカーの再生数・投稿日・長さを YouTube Data API で更新し、消えた動画を論理削除する（T24・ADR 0017）。
 * 毎晩の sync-firestore.yml が、公開データを作り直す前に呼ぶ。
 *
 *   node scripts/refresh-youtube.mjs            更新して書く
 *   node scripts/refresh-youtube.mjs --dry-run  計画だけ出して書かない
 *
 * 環境変数: YOUTUBE_API_KEY（Secrets）、GOOGLE_ACCESS_TOKEN（Workload Identity 連携）、GCP_PROJECT
 *
 * 守ること:
 * - YouTube API が 1 回でも失敗したら、何も書かずに止まる（取れなかった動画を「消えた」と誤認しないため）
 * - 論理削除は deleted と updatedAt を進める書き込み（ADR 0013）。再生数の更新は updatedAt を進めない
 *   （閲覧中の画面に差分を流す必要が無く、直後の同期で公開データに入るため）
 * - 実行の記録を jobs/youtube-refresh に残す（管理者だけが読める）
 */

import { fromFields } from './lib/firestore-rest.mjs';
import { VIDEOS_PER_CALL, planRefresh } from './lib/youtube-refresh.mjs';
import { writeSummary } from './lib/summary.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const { YOUTUBE_API_KEY, GOOGLE_ACCESS_TOKEN, GCP_PROJECT } = process.env;
if (!YOUTUBE_API_KEY || !GOOGLE_ACCESS_TOKEN || !GCP_PROJECT) {
  console.error('NG: YOUTUBE_API_KEY・GOOGLE_ACCESS_TOKEN・GCP_PROJECT のどれかがありません');
  process.exit(2);
}

const DB = `projects/${GCP_PROJECT}/databases/(default)`;
const API = `https://firestore.googleapis.com/v1/${DB}`;
const headers = { Authorization: `Bearer ${GOOGLE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };

async function mustOk(res, what) {
  if (!res.ok) {
    console.error(`NG: ${what} が HTTP ${res.status} を返しました: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  return res.json();
}

/** 論理削除されていないマーカーの ID と動画 ID。 */
async function liveMarkers() {
  const rows = [];
  let pageToken = '';
  do {
    const url = new URL(`${API}/documents/markers`);
    url.searchParams.set('pageSize', '300');
    for (const f of ['videoId', 'deleted']) url.searchParams.append('mask.fieldPaths', f);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const body = await mustOk(await fetch(url, { headers }), 'マーカーの読み出し');
    for (const doc of body.documents ?? []) rows.push({ id: doc.name.split('/').pop(), ...fromFields(doc.fields ?? {}) });
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return rows.filter((m) => m.deleted !== true && m.videoId);
}

/** 動画情報を 50 本ずつ取る。1 回でも失敗したら止まる。 */
async function fetchVideos(videoIds) {
  const items = [];
  let calls = 0;
  for (let i = 0; i < videoIds.length; i += VIDEOS_PER_CALL) {
    const ids = videoIds.slice(i, i + VIDEOS_PER_CALL).join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${ids}&key=${YOUTUBE_API_KEY}`;
    const body = await mustOk(await fetch(url), 'YouTube Data API');
    items.push(...(body.items ?? []));
    calls += 1;
  }
  return { items, calls };
}

const docName = (collection, id) => `${DB}/documents/${collection}/${id}`;
const now = { setToServerValue: 'REQUEST_TIME' };

function statsWrite({ id, youtube }) {
  const fields = {};
  for (const [k, v] of Object.entries(youtube)) {
    fields[k] = k === 'publishedAt' ? { timestampValue: v } : { integerValue: String(v) };
  }
  return {
    update: { name: docName('markers', id), fields: { youtube: { mapValue: { fields } } } },
    updateMask: { fieldPaths: ['youtube'] },
    updateTransforms: [{ fieldPath: 'youtube.checkedAt', ...now }],
    currentDocument: { exists: true },
  };
}

function goneWrite(id) {
  return {
    update: { name: docName('markers', id), fields: { deleted: { booleanValue: true }, deletedReason: { stringValue: 'unavailable' } } },
    updateMask: { fieldPaths: ['deleted', 'deletedReason'] },
    updateTransforms: [{ fieldPath: 'updatedAt', ...now }],
    currentDocument: { exists: true },
  };
}

/** 500 件ずつ書く（commit の上限）。 */
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 500) {
    await mustOk(
      await fetch(`${API}/documents:commit`, { method: 'POST', headers, body: JSON.stringify({ writes: writes.slice(i, i + 500) }) }),
      'Firestore への書き込み',
    );
  }
}

const markers = await liveMarkers();
const { items, calls } = await fetchVideos([...new Set(markers.map((m) => m.videoId))]);
const plan = planRefresh(markers, items);

console.log(`対象 ${markers.length} 件・YouTube API ${calls} 回（${calls} ユニット）`);
console.log(`更新 ${plan.updates.length} 件・論理削除 ${plan.gone.length} 件${plan.blockedGone ? `（${plan.blockedGone} 件は割合が多すぎるので止めた）` : ''}`);
if (plan.gone.length) console.log(`論理削除: ${plan.gone.join(', ')}`);
// Actions のジョブ概要に件数を出す（T31）
writeSummary(DRY_RUN ? 'YouTube の情報の更新（確認だけ）' : 'YouTube の情報の更新', [
  ['対象のマーカー', `${markers.length} 件`],
  ['YouTube API の呼び出し', `${calls} 回（${calls} ユニット）`],
  ['再生数などの更新', `${plan.updates.length} 件`],
  ['消えた動画の論理削除', `${plan.gone.length} 件${plan.blockedGone ? `（${plan.blockedGone} 件は割合が多すぎるので止めた）` : ''}`],
]);

if (DRY_RUN) {
  console.log('--dry-run のため書き込みません');
  process.exit(0);
}

const summary = { checked: markers.length, updated: plan.updates.length, gone: plan.gone.length, blockedGone: plan.blockedGone, apiCalls: calls };
await commit([
  ...plan.updates.map(statsWrite),
  ...plan.gone.map(goneWrite),
  {
    update: {
      name: docName('jobs', 'youtube-refresh'),
      fields: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { integerValue: String(v) }])),
    },
    updateTransforms: [{ fieldPath: 'ranAt', ...now }],
  },
]);
console.log('OK  書き込みました（jobs/youtube-refresh に記録）');
// 割合で削除を止めたときは、人が確かめるまで気づけるよう失敗で終える
if (plan.blockedGone) {
  console.error('NG: 消えた動画が多すぎるため論理削除を止めました。YouTube 側の状態を確かめてください');
  process.exit(1);
}
