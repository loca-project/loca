/**
 * マーカーの再生数・投稿日・長さを YouTube Data API で更新し、消えた動画を論理削除する（T24・ADR 0017）。
 * 毎晩の sync-firestore.yml が、公開データを作り直す前に呼ぶ。
 * 動画のチャンネル ID と、投稿者が自己申告したチャンネル（users の channel）を照合して youtube.ownChannel を付ける（T55・ADR 0029）。
 *
 *   node scripts/refresh-youtube.mjs            更新して書く
 *   node scripts/refresh-youtube.mjs --dry-run  計画だけ出して書かない
 *   node scripts/refresh-youtube.mjs --missing-only
 *       毎時の更新（T57）。登録から 48 時間以内で、まだ YouTube の情報が無いマーカーだけを取る。
 *       対象が無ければ YouTube API を呼ばない。記録は jobs/youtube-refresh-hourly
 *
 * Actions では、何か書いたかを GITHUB_OUTPUT の changed（true / false）で返す（毎時は変更があるときだけ同期する）。
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
import { appendFileSync } from 'node:fs';
import { HANDLE, MISSING_WINDOW_MS, VIDEOS_PER_CALL, missingTargets, ownerChannelMap, planRefresh } from './lib/youtube-refresh.mjs';
import { writeSummary } from './lib/summary.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const MISSING_ONLY = process.argv.includes('--missing-only');
const JOB_ID = MISSING_ONLY ? 'youtube-refresh-hourly' : 'youtube-refresh';
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
    for (const f of ['videoId', 'deleted', 'ownerUid']) url.searchParams.append('mask.fieldPaths', f);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const body = await mustOk(await fetch(url, { headers }), 'マーカーの読み出し');
    for (const doc of body.documents ?? []) rows.push({ id: doc.name.split('/').pop(), ...fromFields(doc.fields ?? {}) });
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return rows.filter((m) => m.deleted !== true && m.videoId);
}

/** 登録から MISSING_WINDOW_MS 以内で、YouTube の情報をまだ取っていないマーカー（毎時の更新。T57）。 */
async function recentMissingMarkers() {
  const since = new Date(Date.now() - MISSING_WINDOW_MS).toISOString();
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'markers' }],
      where: { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: since } } },
      select: { fields: ['videoId', 'deleted', 'youtube', 'ownerUid'].map((fieldPath) => ({ fieldPath })) },
    },
  };
  const body = await mustOk(
    await fetch(`${API}/documents:runQuery`, { method: 'POST', headers, body: JSON.stringify(query) }),
    '新しいマーカーの読み出し',
  );
  const rows = body
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split('/').pop(), ...fromFields(r.document.fields ?? {}) }));
  return missingTargets(rows);
}

/** Actions の後続のジョブに、何か書いたかを渡す。Actions の外では何もしない。 */
function setOutput(changed) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, 'utf8');
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

/**
 * 対象のマーカーの投稿者の users だけを読み、自己申告のチャンネルを持つ行（{ id, channel }）を返す。
 * IAM の経路で読む（users はルールでは本人と管理者だけ）。全件は読まない（毎時の回で読み取りを増やさないため）。
 */
async function usersWithChannel(uids) {
  const rows = [];
  for (let i = 0; i < uids.length; i += 100) {
    const body = { documents: uids.slice(i, i + 100).map((uid) => docName('users', uid)), mask: { fieldPaths: ['channel'] } };
    const res = await mustOk(await fetch(`${API}/documents:batchGet`, { method: 'POST', headers, body: JSON.stringify(body) }), 'プロフィールの読み出し');
    for (const r of res) {
      if (r.found) rows.push({ id: r.found.name.split('/').pop(), ...fromFields(r.found.fields ?? {}) });
    }
  }
  return rows.filter((u) => typeof u.channel === 'string');
}

/** @ハンドル を channels.list の forHandle でチャンネル ID に直す（1 件 1 ユニット）。見つからないハンドルは入れない。 */
async function resolveHandles(handles) {
  const ids = new Map();
  for (const handle of handles) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`;
    const body = await mustOk(await fetch(url), 'YouTube Data API（channels）');
    const id = body.items?.[0]?.id;
    if (id) ids.set(handle.toLowerCase(), id);
  }
  return ids;
}

const docName = (collection, id) => `${DB}/documents/${collection}/${id}`;
const now = { setToServerValue: 'REQUEST_TIME' };

function statsWrite({ id, youtube }) {
  const fields = {};
  for (const [k, v] of Object.entries(youtube)) {
    if (k === 'publishedAt') fields[k] = { timestampValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else fields[k] = { integerValue: String(v) };
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

const markers = MISSING_ONLY ? await recentMissingMarkers() : await liveMarkers();
const { items, calls: videoCalls } = await fetchVideos([...new Set(markers.map((m) => m.videoId))]);
// 投稿者の自己申告のチャンネル（T55）。対象のマーカーの投稿者の分だけハンドルを ID に直す
const owners = [...new Set(markers.map((m) => m.ownerUid).filter((u) => typeof u === 'string' && u))];
const users = owners.length ? await usersWithChannel(owners) : [];
const handles = [...new Set(users.map((u) => u.channel).filter((c) => HANDLE.test(c)).map((c) => c.toLowerCase()))];
const handleIds = await resolveHandles(handles);
const calls = videoCalls + handles.length;
const plan = planRefresh(markers, items, ownerChannelMap(users, handleIds));
const ownCount = plan.updates.filter((u) => u.youtube.ownChannel).length;

console.log(`対象 ${markers.length} 件・YouTube API ${calls} 回（${calls} ユニット）`);
console.log(`更新 ${plan.updates.length} 件・論理削除 ${plan.gone.length} 件${plan.blockedGone ? `（${plan.blockedGone} 件は割合が多すぎるので止めた）` : ''}`);
if (plan.gone.length) console.log(`論理削除: ${plan.gone.join(', ')}`);
// Actions のジョブ概要に件数を出す（T31）
const title = MISSING_ONLY ? 'YouTube の情報の取得（毎時・未取得だけ）' : 'YouTube の情報の更新';
writeSummary(DRY_RUN ? `${title}（確認だけ）` : title, [
  ['対象のマーカー', `${markers.length} 件`],
  ['YouTube API の呼び出し', `${calls} 回（${calls} ユニット）`],
  ['再生数などの更新', `${plan.updates.length} 件`],
  ['本人のチャンネルの動画（自己申告と一致）', `${ownCount} 件（チャンネルを登録した投稿者 ${users.length} 人）`],
  ['消えた動画の論理削除', `${plan.gone.length} 件${plan.blockedGone ? `（${plan.blockedGone} 件は割合が多すぎるので止めた）` : ''}`],
]);

if (DRY_RUN) {
  console.log('--dry-run のため書き込みません');
  setOutput(false);
  process.exit(0);
}

const summary = { checked: markers.length, updated: plan.updates.length, gone: plan.gone.length, blockedGone: plan.blockedGone, apiCalls: calls };
await commit([
  ...plan.updates.map(statsWrite),
  ...plan.gone.map(goneWrite),
  {
    update: {
      name: docName('jobs', JOB_ID),
      fields: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { integerValue: String(v) }])),
    },
    updateTransforms: [{ fieldPath: 'ranAt', ...now }],
  },
]);
console.log(`OK  書き込みました（jobs/${JOB_ID} に記録）`);
setOutput(plan.updates.length + plan.gone.length > 0);
// 割合で削除を止めたときは、人が確かめるまで気づけるよう失敗で終える
if (plan.blockedGone) {
  console.error('NG: 消えた動画が多すぎるため論理削除を止めました。YouTube 側の状態を確かめてください');
  process.exit(1);
}
