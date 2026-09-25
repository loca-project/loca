/**
 * 機器マスタ public/data/equipment.json を、管理者が画面で直した分類（Firestore の equipmentMaster）と
 * コードの既定（scripts/data/equipment-master.mjs）から作り直す（ADR 0025・T28）。
 * 3 時間ごとに .github/workflows/sync-equipment.yml が動かす。毎晩の同期（sync-firestore.mjs）は機器マスタに触らない。
 *
 *   npm run data:sync-equipment              変更があれば書く
 *   npm run data:sync-equipment -- --check   書かずに結果だけ出す
 *
 * 検査に落ちた分類は既定のまま出し、理由を NG として残す（ほかの分類の公開は止めない）。
 * equipmentMaster はルールで誰でも読めるので、API キー（公開値）だけで読む。
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { firestoreConfig } from './lib/env.mjs';
import { listCollection } from './lib/firestore-rest.mjs';
import { buildEquipment } from './lib/equipment-master.mjs';
import { writeSummary } from './lib/summary.mjs';

const FILE = path.join(process.cwd(), 'public', 'data', 'equipment.json');
const CHECK_ONLY = process.argv.includes('--check');

const config = await firestoreConfig();
if (!config) {
  console.error('NG: VITE_FIREBASE_API_KEY と VITE_FIREBASE_PROJECT_ID が環境変数にも .env.local にもありません');
  process.exit(2);
}

const { defs, edited, problems } = buildEquipment(await listCollection(config, 'equipmentMaster'));
problems.forEach((p) => console.warn(`NG  機器マスタ: ${p}`));

const before = await readFile(FILE, 'utf8');
const after = `${JSON.stringify(defs, null, 2)}\n`;
const changed = before.replace(/\r\n/g, '\n') !== after;
const line = `画面で直した分類 ${edited.length} 件・NG ${problems.length} 件（${changed ? '変更あり' : '変更なし'}）`;
console.log(`equipment.json: ${line}`);
if (changed && !CHECK_ONLY) {
  await writeFile(FILE, after, 'utf8');
  console.log('OK  equipment.json を書きました');
}
// Actions のジョブ概要に件数を出す（T31）
writeSummary(CHECK_ONLY ? '機器マスタ（確認だけ）' : '機器マスタ（Firestore → equipment.json）', [
  ['画面で直した分類', edited.length ? edited.join('・') : 'なし'],
  ['NG', `${problems.length} 件`],
  ['equipment.json', changed ? '変更あり' : '変更なし'],
]);
