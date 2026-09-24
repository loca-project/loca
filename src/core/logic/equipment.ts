/** 機器マスタ（分類 → メーカー → シリーズ → モデル。ADR 0018）の参照ヘルパ。 */

import type { Equipment, EquipmentDef } from '@/core/types';

export const EMPTY_EQUIPMENT: Required<Equipment> = { category: '', manufacturer: '', series: '', model: '' };

export function categoriesOf(defs: EquipmentDef[]): string[] {
  return defs.map((d) => d.category);
}

export function makersOf(defs: EquipmentDef[], category: string): string[] {
  if (!category) return [];
  return defs.find((d) => d.category === category)?.makers.map((m) => m.name) ?? [];
}

export function seriesOf(defs: EquipmentDef[], category: string, manufacturer: string): string[] {
  if (!category || !manufacturer) return [];
  const maker = defs.find((d) => d.category === category)?.makers.find((m) => m.name === manufacturer);
  return maker?.series.map((s) => s.name) ?? [];
}

export function modelsOf(defs: EquipmentDef[], category: string, manufacturer: string, series: string): string[] {
  if (!category || !manufacturer || !series) return [];
  const maker = defs.find((d) => d.category === category)?.makers.find((m) => m.name === manufacturer);
  return maker?.series.find((s) => s.name === series)?.models ?? [];
}

/**
 * 組み合わせがマスタに存在するか。すべて空なら「未入力」として妥当。
 * 分類だけ（メーカーは空）も妥当。下の段は上の段が決まっていないと選べない。
 */
export function isValidEquipment(defs: EquipmentDef[], eq: Equipment): boolean {
  const { category = '', manufacturer, series, model } = eq;
  if (!category && !manufacturer && !series && !model) return true;
  if (!categoriesOf(defs).includes(category)) return false;
  if (!manufacturer) return !series && !model;
  if (!makersOf(defs, category).includes(manufacturer)) return false;
  if (series && !seriesOf(defs, category, manufacturer).includes(series)) return false;
  if (model && (!series || !modelsOf(defs, category, manufacturer, series).includes(model))) return false;
  return true;
}

/** 画面に出す「メーカー / シリーズ / モデル」（分類は画面側で訳して前に付ける）。 */
export function equipmentText(eq: Equipment | undefined): string {
  return [eq?.manufacturer, eq?.series, eq?.model].filter(Boolean).join(' / ');
}
