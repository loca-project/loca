/**
 * 撮影機器マスタ public/data/equipment.json を作る（ADR 0018）。元データは scripts/data/equipment-master.mjs。
 * 分類のキーが一覧にあること、同じ分類の中でメーカー・シリーズ・モデルが重複しないことを確かめてから書く。
 *
 *   npm run data:equipment
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EQUIPMENT_MASTER } from './data/equipment-master.mjs';

const CATEGORIES = ['drone', 'mirrorless', 'cinema', 'action', 'gimbal', 'camera360', 'smartphone', 'camcorder', 'other'];

const problems = [];
const dup = (label, names) => {
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) problems.push(`${label} に「${n}」が重複`);
    seen.add(n);
  }
};
dup('分類', EQUIPMENT_MASTER.map((c) => c.category));
for (const c of EQUIPMENT_MASTER) {
  if (!CATEGORIES.includes(c.category)) problems.push(`知らない分類「${c.category}」`);
  dup(c.category, c.makers.map((m) => m.name));
  for (const m of c.makers) {
    dup(`${c.category}/${m.name}`, m.series.map((s) => s.name));
    for (const s of m.series) dup(`${c.category}/${m.name}/${s.name}`, s.models);
  }
}
if (problems.length) {
  problems.forEach((p) => console.error(`NG: ${p}`));
  process.exit(1);
}

const out = path.join(process.cwd(), 'public', 'data', 'equipment.json');
await writeFile(out, `${JSON.stringify(EQUIPMENT_MASTER, null, 2)}\n`, 'utf8');
const makers = EQUIPMENT_MASTER.reduce((n, c) => n + c.makers.length, 0);
console.log(`OK: equipment.json を書き出しました（分類 ${EQUIPMENT_MASTER.length}・メーカー ${makers}）`);
