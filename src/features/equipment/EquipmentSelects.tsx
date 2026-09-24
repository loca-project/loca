/**
 * 撮影機器の 4 段の選択（分類 → メーカー → シリーズ → モデル。ADR 0018）。
 * 上の段が決まるまで下の段は選べない。上の段を変えたら下の段は未選択に戻す。
 * 登録フォーム・撮影リクエスト・ランキングの機器フィルターで共通に使う。
 */

import React from 'react';
import type { Equipment, EquipmentDef } from '@/core/types';
import { equipmentCategoryLabel } from '@/core/constants';
import { categoriesOf, makersOf, modelsOf, seriesOf } from '@/core/logic/equipment';
import { Select } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface EquipmentSelectsProps {
  defs: EquipmentDef[];
  value: Required<Equipment>;
  onChange: (next: Required<Equipment>) => void;
  /** input は「〜を選択」、filter は「すべて」を先頭に出す */
  mode: 'input' | 'filter';
}

export default function EquipmentSelects({ defs, value, onChange, mode }: EquipmentSelectsProps) {
  const { t, lang } = useI18n();
  const first = (inputLabel: string) => ({ value: '', label: mode === 'input' ? inputLabel : t.filters.any });
  const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));
  const { category, manufacturer, series, model } = value;

  return (
    <>
      <Select
        aria-label={t.form.category}
        value={category}
        options={[
          first(t.form.selectCategory),
          ...categoriesOf(defs).map((c) => ({ value: c, label: equipmentCategoryLabel(c, lang) })),
        ]}
        onChange={(e) => onChange({ category: e.target.value, manufacturer: '', series: '', model: '' })}
      />
      <Select
        aria-label={t.form.maker}
        value={manufacturer}
        disabled={!category}
        options={[first(t.form.selectMaker), ...toOptions(makersOf(defs, category))]}
        onChange={(e) => onChange({ ...value, manufacturer: e.target.value, series: '', model: '' })}
      />
      <Select
        aria-label={t.form.series}
        value={series}
        disabled={!manufacturer}
        options={[first(t.form.selectSeries), ...toOptions(seriesOf(defs, category, manufacturer))]}
        onChange={(e) => onChange({ ...value, series: e.target.value, model: '' })}
      />
      <Select
        aria-label={t.form.model}
        value={model}
        disabled={!series}
        options={[first(t.form.selectModel), ...toOptions(modelsOf(defs, category, manufacturer, series))]}
        onChange={(e) => onChange({ ...value, model: e.target.value })}
      />
    </>
  );
}
