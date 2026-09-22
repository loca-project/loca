/** 機器マスタ（メーカー→シリーズ→モデル）の参照ヘルパ。 */

import type { EquipmentDef } from '@/core/types';

export function manufacturers(defs: EquipmentDef[]): string[] {
  return defs.map((d) => d.manufacturer);
}

export function seriesOf(defs: EquipmentDef[], manufacturer: string): string[] {
  if (!manufacturer) return [];
  return defs.find((d) => d.manufacturer === manufacturer)?.series.map((s) => s.name) ?? [];
}

export function modelsOf(defs: EquipmentDef[], manufacturer: string, series: string): string[] {
  if (!manufacturer || !series) return [];
  const maker = defs.find((d) => d.manufacturer === manufacturer);
  return maker?.series.find((s) => s.name === series)?.models ?? [];
}

/**
 * 登録されようとしている組み合わせがマスタに存在するか。
 * 3 項目すべて空なら「未入力」として妥当とみなす。
 */
export function isValidEquipment(
  defs: EquipmentDef[],
  manufacturer: string,
  series: string,
  model: string,
): boolean {
  if (!manufacturer && !series && !model) return true;
  if (!manufacturer) return false;
  if (!manufacturers(defs).includes(manufacturer)) return false;
  if (series && !seriesOf(defs, manufacturer).includes(series)) return false;
  if (model && !modelsOf(defs, manufacturer, series).includes(model)) return false;
  return true;
}
