/**
 * Firestore から public/data/markers.json と requests.json を作り直す（要件 1.3 の定時バッチ。ADR 0010）。
 *
 *   npm run data:sync              変更があれば書く
 *   npm run data:sync:check        書かずに件数だけ出す
 *
 * 合わせ方は lib/merge-markers.mjs と lib/merge-requests.mjs。
 * 地名が空の行・地点は国土地理院で補う（1 回 50 件まで）。
 * syncedAt は「読み始めた時刻」。アプリはこれより後の変更だけを onSnapshot で購読する。
 * 読んでいる間の変更は両方に入りうるが、同じ ID で上書き・重複除外されるだけで欠けはしない。
 *
 * 変更が無いファイルは書かない（毎日の空コミットを作らないため）。
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { firestoreConfig } from './lib/env.mjs';
import { listCollection } from './lib/firestore-rest.mjs';
import { fetchPlace } from './lib/enrich.mjs';
import { mergeMarkers } from './lib/merge-markers.mjs';
import { mergeRequests } from './lib/merge-requests.mjs';

const DATA = path.join(process.cwd(), 'public', 'data');
const CHECK_ONLY = process.argv.includes('--check');
const MAX_PLACE_LOOKUPS = 50;

const config = await firestoreConfig();
if (!config) {
  console.error('NG: VITE_FIREBASE_API_KEY と VITE_FIREBASE_PROJECT_ID が環境変数にも .env.local にもありません');
  process.exit(2);
}

async function readList(file) {
  const raw = JSON.parse(await readFile(path.join(DATA, file), 'utf8'));
  return Array.isArray(raw) ? raw : (raw.markers ?? []);
}

let lookups = 0;
/** 地名が空のものを補う。問い合わせは全体で MAX_PLACE_LOOKUPS 件まで。 */
async function fillPlaces(items) {
  for (const item of items) {
    if (item.prefecture || lookups >= MAX_PLACE_LOOKUPS) continue;
    lookups += 1;
    Object.assign(item, await fetchPlace(item.lat, item.lng));
  }
}

/** 項目の並び順に左右されずに比べる（地名を足す順などで順序が変わっても「変更なし」にする）。 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

async function save(file, before, after, syncedAt) {
  const changed = JSON.stringify(canonical(after)) !== JSON.stringify(canonical(before));
  console.log(`${file}: ${before.length} 件 → ${after.length} 件（${changed ? '変更あり' : '変更なし'}）`);
  if (!changed || CHECK_ONLY) return;
  const bundle = { generatedAt: Date.now(), syncedAt, markers: after };
  await writeFile(path.join(DATA, file), `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  console.log(`OK  ${file} を書きました`);
}

const syncedAt = Date.now();
const [markerRows, requestRows] = await Promise.all([
  listCollection(config, 'markers'),
  listCollection(config, 'requests'),
]);
const [currentMarkers, currentSpots] = await Promise.all([readList('markers.json'), readList('requests.json')]);

const markers = mergeMarkers(markerRows, currentMarkers);
await fillPlaces(markers.markers);
const spots = mergeRequests(requestRows, currentSpots);
await fillPlaces(spots);

console.log(`Firestore markers ${markerRows.length} 件（公開 ${markers.live}・論理削除 ${markers.deleted}）、requests ${requestRows.length} 件`);
console.log(`地名の問い合わせ ${lookups} 件`);
await save('markers.json', currentMarkers, markers.markers, syncedAt);
await save('requests.json', currentSpots, spots, syncedAt);
