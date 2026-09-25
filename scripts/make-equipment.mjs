/**
 * 撮影機器マスタ public/data/equipment.json をコードの既定から作る（ADR 0018）。元データは scripts/data/equipment-master.mjs。
 * 分類の並びが一覧どおりで、同じ段の名前が重複せず 80 字以内であることを確かめてから書く（scripts/lib/equipment-master.mjs）。
 * 管理者が画面で直した分類（Firestore の equipmentMaster）は、3 時間ごとの機器の同期（sync-equipment.mjs）が上書きする（ADR 0025）。
 *
 *   npm run data:equipment
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EQUIPMENT_MASTER } from './data/equipment-master.mjs';
import { checkDefault } from './lib/equipment-master.mjs';

const problems = checkDefault();
if (problems.length) {
  problems.forEach((p) => console.error(`NG: ${p}`));
  process.exit(1);
}

const out = path.join(process.cwd(), 'public', 'data', 'equipment.json');
await writeFile(out, `${JSON.stringify(EQUIPMENT_MASTER, null, 2)}\n`, 'utf8');
const makers = EQUIPMENT_MASTER.reduce((n, c) => n + c.makers.length, 0);
console.log(`OK: equipment.json を書き出しました（分類 ${EQUIPMENT_MASTER.length}・メーカー ${makers}）`);
