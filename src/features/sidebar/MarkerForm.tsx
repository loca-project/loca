/**
 * マーカー投稿フォーム（要件 3.3）。
 * 入力の並びは要件どおり URL → 感情タグ3種 → GPS → 撮影機器。
 * 送信すると GitHub の Issue フォームが開く（このアプリは保存しない）。
 */

import React from 'react';
import type { EquipmentDef } from '@/core/types';
import { TAG_CATEGORIES } from '@/core/constants';
import { modelsOf, seriesOf } from '@/core/logic/equipment';
import { Button, Field, RadioGroup, Select, TextInput } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import type { MarkerFormState } from '@/features/marker/formState';

interface MarkerFormProps {
  form: MarkerFormState;
  equipment: EquipmentDef[];
  loading: boolean;
  onChange: (patch: Partial<MarkerFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const TAG_FIELD: Record<string, keyof MarkerFormState> = {
  action: 'tagAction',
  atmosphere: 'tagAtmosphere',
  emotion: 'tagEmotion',
};

export default function MarkerForm({
  form,
  equipment,
  loading,
  onChange,
  onSubmit,
  onCancel,
}: MarkerFormProps) {
  const { t } = useI18n();

  const makerOptions = [
    { value: '', label: t.form.selectMaker },
    ...equipment.map((d) => ({ value: d.manufacturer, label: d.manufacturer })),
  ];
  const seriesOptions = [
    { value: '', label: t.form.selectSeries },
    ...seriesOf(equipment, form.manufacturer).map((s) => ({ value: s, label: s })),
  ];
  const modelOptions = [
    { value: '', label: t.form.selectModel },
    ...modelsOf(equipment, form.manufacturer, form.series).map((m) => ({ value: m, label: m })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Field label={t.form.url}>
        <TextInput
          value={form.youtubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          onChange={(e) => onChange({ youtubeUrl: e.target.value })}
        />
      </Field>

      {TAG_CATEGORIES.map((category) => (
        <Field key={category.key} label={t.form[category.labelKey as keyof typeof t.form] as string}>
          <RadioGroup
            name={category.key}
            options={category.options}
            value={form[TAG_FIELD[category.key]]}
            onChange={(v) => onChange({ [TAG_FIELD[category.key]]: v } as Partial<MarkerFormState>)}
          />
        </Field>
      ))}

      <div className="grid grid-cols-2 gap-2">
        <Field label={t.form.lat}>
          <TextInput
            value={form.lat}
            inputMode="decimal"
            onChange={(e) => onChange({ lat: e.target.value })}
          />
        </Field>
        <Field label={t.form.lng}>
          <TextInput
            value={form.lng}
            inputMode="decimal"
            onChange={(e) => onChange({ lng: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded border border-gray-100 bg-gray-50 p-2">
        <span className="text-[11px] font-bold text-gray-500">{t.form.equipment}</span>
        <Select
          aria-label={t.form.maker}
          value={form.manufacturer}
          options={makerOptions}
          onChange={(e) => onChange({ manufacturer: e.target.value, series: '', model: '' })}
        />
        <Select
          aria-label={t.form.series}
          value={form.series}
          options={seriesOptions}
          disabled={!form.manufacturer}
          onChange={(e) => onChange({ series: e.target.value, model: '' })}
        />
        <Select
          aria-label={t.form.model}
          value={form.model}
          options={modelOptions}
          disabled={!form.series}
          onChange={(e) => onChange({ model: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onSubmit} disabled={loading}>
          <i className="fa-brands fa-github mr-1.5" />
          {loading ? t.contribute.checking : t.contribute.submit}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {t.form.cancel}
        </Button>
      </div>

      <p className="rounded bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-500">
        <i className="fa-solid fa-circle-info mr-1" />
        {t.contribute.openedBody}
      </p>
    </div>
  );
}
