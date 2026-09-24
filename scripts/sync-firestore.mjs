/**
 * Firestore の markers から public/data/markers.json を作り直す（要件 1.3 の定時バッチ。ADR 0010）。
 *
 *   npm run data:sync              変更があれば markers.json を書く
 *   npm run data:sync:check        書かずに件数だけ出す
 *
 * 合わせ方（論理削除の除外・Issue 経由の行の維持）は lib/merge-markers.mjs。
 * 地名が空の行は国土地理院で補う（1 回 50 件まで）。
 * syncedAt は「読み始めた時刻」。アプリはこれより後の変更だけを onSnapshot で購読する。
 * 読んでいる間の変更は両方に入りうるが、同じ ID で上書きされるだけで欠けはしない。
 *
 * 変更が無ければ書かない（毎日の空コミットを作らないため）。
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { firestoreConfig } from './lib/env.mjs';
import { listCollection } from './lib/firestore-rest.mjs';
import { fetchPlace } from './lib/enrich.mjs';
import { mergeMarkers } from './lib/merge-markers.mjs';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'public', 'data', 'markers.json');
const CHECK_ONLY = process.argv.includes('--check');
const MAX_PLACE_LOOKUPS = 50;

const config = await firestoreConfig();
if (!config) {
  console.error('NG: VITE_FIREBASE_API_KEY と VITE_FIREBASE_PROJECT_ID が環境変数にも .env.local にもありません');
  process.exit(2);
}

const current = JSON.parse(await readFile(FILE, 'utf8'));
const currentMarkers = Array.isArray(current) ? current : (current.markers ?? []);

const syncedAt = Date.now();
const rows = await listCollection(config, 'markers');
const result = mergeMarkers(rows, currentMarkers);

let lookups = 0;
for (const m of result.markers) {
  if (m.prefecture || !m.ownerUid || lookups >= MAX_PLACE_LOOKUPS) continue;
  lookups += 1;
  Object.assign(m, await fetchPlace(m.lat, m.lng));
}

const changed = JSON.stringify(result.markers) !== JSON.stringify(currentMarkers);
console.log(`Firestore ${rows.length} 件（公開 ${result.live}・論理削除 ${result.deleted}）`);
console.log(`Issue 経由 ${result.fromIssues} 件を維持、地名の問い合わせ ${lookups} 件`);
console.log(`markers.json: ${currentMarkers.length} 件 → ${result.markers.length} 件（${changed ? '変更あり' : '変更なし'}）`);

if (!changed || CHECK_ONLY) process.exit(0);
const bundle = { generatedAt: Date.now(), syncedAt, markers: result.markers };
await writeFile(FILE, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
console.log('OK  markers.json を書きました');
