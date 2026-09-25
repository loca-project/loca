/**
 * 管理者画面で機器マスタの 1 分類を編集する文章と、一覧の変換（ADR 0025）。
 *
 *   DJI              ← メーカー（字下げなし）
 *     Mavic          ← シリーズ（2 字下げ）
 *       Mavic 3 Pro  ← モデル（4 字下げ）
 *
 * 同期の同じ検査は scripts/lib/equipment-master.mjs（名前は 80 字まで・同じ段で重複しない）。
 */

import type { EquipmentDef } from '@/core/types';

export type EquipmentMakers = EquipmentDef['makers'];

/** 名前の長さの上限（ルールの validEquipment と同じ） */
const MAX_NAME = 80;
/** 1 分類のメーカーの上限（ルールの equipmentMaster と同じ） */
export const MAX_MAKERS = 60;
/** 1 分類のシリーズ・モデルの上限（同期の scripts/lib/equipment-master.mjs と同じ。equipment.json は全員が読む） */
export const MAX_SERIES = 200;
export const MAX_MODELS = 1000;

export interface ParseProblem {
  /** 1 から数えた行番号 */
  line: number;
  kind: 'indent' | 'orphan' | 'long' | 'duplicate' | 'tooMany' | 'tooManySeries' | 'tooManyModels';
  name: string;
}

/** 一覧を編集用の文章にする。 */
export function makersToText(makers: EquipmentMakers): string {
  const lines: string[] = [];
  for (const m of makers) {
    lines.push(m.name);
    for (const s of m.series) {
      lines.push(`  ${s.name}`);
      for (const model of s.models) lines.push(`    ${model}`);
    }
  }
  return lines.join('\n');
}

/** 文章を一覧にする。空行は読み飛ばす。問題が 1 件でもあれば一覧は使わないこと。 */
export function textToMakers(text: string): { makers: EquipmentMakers; problems: ParseProblem[] } {
  const makers: EquipmentMakers = [];
  const problems: ParseProblem[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const line = i + 1;
    const name = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    if (name.length > MAX_NAME) problems.push({ line, kind: 'long', name });
    const level = indent === 0 ? 0 : indent === 2 ? 1 : indent === 4 ? 2 : -1;
    if (level < 0 || raw.slice(0, indent).includes('\t')) {
      problems.push({ line, kind: 'indent', name });
      return;
    }
    const maker = makers[makers.length - 1];
    const series = maker?.series[maker.series.length - 1];
    if (level === 0) {
      if (makers.some((m) => m.name === name)) problems.push({ line, kind: 'duplicate', name });
      makers.push({ name, series: [] });
    } else if (level === 1) {
      if (!maker) return void problems.push({ line, kind: 'orphan', name });
      if (maker.series.some((s) => s.name === name)) problems.push({ line, kind: 'duplicate', name });
      maker.series.push({ name, models: [] });
    } else {
      if (!series) return void problems.push({ line, kind: 'orphan', name });
      if (series.models.includes(name)) problems.push({ line, kind: 'duplicate', name });
      series.models.push(name);
    }
  });
  const counts = countMakers(makers);
  if (counts.makers > MAX_MAKERS) problems.push({ line: 0, kind: 'tooMany', name: String(counts.makers) });
  if (counts.series > MAX_SERIES) problems.push({ line: 0, kind: 'tooManySeries', name: String(counts.series) });
  if (counts.models > MAX_MODELS) problems.push({ line: 0, kind: 'tooManyModels', name: String(counts.models) });
  return { makers, problems };
}

/** 件数（メーカー・シリーズ・モデル）。保存前の確認に出す。 */
export function countMakers(makers: EquipmentMakers): { makers: number; series: number; models: number } {
  let series = 0;
  let models = 0;
  for (const m of makers) {
    series += m.series.length;
    for (const s of m.series) models += s.models.length;
  }
  return { makers: makers.length, series, models };
}
