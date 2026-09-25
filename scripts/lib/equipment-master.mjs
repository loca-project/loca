/**
 * 機器マスタの検査と組み立て（ADR 0018・0025）。make-equipment.mjs と sync-firestore.mjs が使う。
 * 画面側の同じ検査は src/core/logic/equipmentText.ts（名前の長さの上限はルールの validEquipment と同じ 80 字）。
 */

import { EQUIPMENT_MASTER } from '../data/equipment-master.mjs';

export const CATEGORIES = ['drone', 'mirrorless', 'cinema', 'action', 'gimbal', 'camera360', 'smartphone', 'camcorder', 'other'];
const MAX_NAME = 80;
/** 1 分類の件数の上限（画面の equipmentText.ts と同じ。equipment.json は全員が読むので大きくしない） */
const MAX = { makers: 60, series: 200, models: 1000 };

/** 1 分類のメーカーの一覧を検査し、問題を文で返す（空なら正しい）。 */
export function checkMakers(label, makers) {
  const problems = [];
  if (!Array.isArray(makers)) return [`${label}: メーカーが一覧ではない`];
  const badName = (n) => typeof n !== 'string' || !n.trim() || n.length > MAX_NAME || /[\r\n]/.test(n);
  const dup = (where, names) => {
    const seen = new Set();
    for (const n of names) {
      if (badName(n)) problems.push(`${where} の名前「${String(n).slice(0, 20)}」が空・${MAX_NAME} 字超・改行入り`);
      else if (seen.has(n)) problems.push(`${where} に「${n}」が重複`);
      seen.add(n);
    }
  };
  dup(label, makers.map((m) => m?.name));
  const series = makers.flatMap((m) => (Array.isArray(m?.series) ? m.series : []));
  const models = series.reduce((n, s) => n + (Array.isArray(s?.models) ? s.models.length : 0), 0);
  for (const [what, count] of [['makers', makers.length], ['series', series.length], ['models', models]]) {
    if (count > MAX[what]) problems.push(`${label}: ${what} が ${count} 件（上限 ${MAX[what]}）`);
  }
  for (const m of makers) {
    if (!Array.isArray(m?.series)) { problems.push(`${label}/${m?.name}: シリーズが一覧ではない`); continue; }
    dup(`${label}/${m.name}`, m.series.map((s) => s?.name));
    for (const s of m.series) {
      if (!Array.isArray(s?.models)) { problems.push(`${label}/${m.name}/${s?.name}: モデルが一覧ではない`); continue; }
      dup(`${label}/${m.name}/${s.name}`, s.models);
    }
  }
  return problems;
}

/** コードの既定（scripts/data/equipment-master.mjs）そのものを検査する。 */
export function checkDefault() {
  const problems = [];
  const cats = EQUIPMENT_MASTER.map((c) => c.category);
  if (cats.join() !== CATEGORIES.join()) problems.push(`分類の並びが一覧と違う: ${cats.join(', ')}`);
  for (const c of EQUIPMENT_MASTER) problems.push(...checkMakers(c.category, c.makers));
  return problems;
}

/**
 * 公開する機器マスタを組み立てる。分類ごとに、Firestore の文書（検査に通ったもの）があればそれ、無ければコードの既定。
 * rows は equipmentMaster の行（{ id: 分類のキー, makers }）。知らない分類と検査に落ちた行は使わず problems に入れる。
 */
export function buildEquipment(rows) {
  const problems = [];
  const edited = new Map();
  for (const row of rows) {
    if (!CATEGORIES.includes(row.id)) { problems.push(`知らない分類「${row.id}」の文書は使わない`); continue; }
    const found = checkMakers(row.id, row.makers);
    if (found.length) { problems.push(...found.map((p) => `${p}（この分類は既定のまま）`)); continue; }
    edited.set(row.id, row.makers.map((m) => ({
      name: m.name,
      series: m.series.map((s) => ({ name: s.name, models: [...s.models] })),
    })));
  }
  const defs = EQUIPMENT_MASTER.map((c) => ({ category: c.category, makers: edited.get(c.category) ?? c.makers }));
  return { defs, edited: [...edited.keys()], problems };
}
