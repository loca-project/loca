/**
 * 撮影機器の分類（ADR 0018）。機器マスタ（equipment.json）の最上段で、値はキーで保存する。
 * キーを変えたら firestore.rules の validEquipment と equipment.json も同じにすること。
 */

export const EQUIPMENT_CATEGORY_KEYS = [
  'drone',
  'mirrorless',
  'cinema',
  'action',
  'gimbal',
  'camera360',
  'smartphone',
  'camcorder',
  'other',
] as const;

export type EquipmentCategoryKey = (typeof EQUIPMENT_CATEGORY_KEYS)[number];

const LABELS: Record<EquipmentCategoryKey, [string, string]> = {
  drone: ['ドローン', 'Drone'],
  mirrorless: ['ミラーレス・一眼', 'Mirrorless / DSLR'],
  cinema: ['シネマカメラ', 'Cinema camera'],
  action: ['アクションカム', 'Action camera'],
  gimbal: ['ジンバルカメラ', 'Gimbal camera'],
  camera360: ['360度カメラ', '360° camera'],
  smartphone: ['スマートフォン', 'Smartphone'],
  camcorder: ['ビデオカメラ', 'Camcorder'],
  other: ['その他', 'Other'],
};

/** 分類の表示名。知らないキーはそのまま返す。 */
export function equipmentCategoryLabel(key: string | undefined, lang: 'ja' | 'en'): string {
  if (!key) return '';
  const pair = (LABELS as Record<string, [string, string]>)[key];
  if (!pair) return key;
  return lang === 'ja' ? pair[0] : pair[1];
}
