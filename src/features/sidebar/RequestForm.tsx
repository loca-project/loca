/**
 * 撮影リクエストの投稿フォーム。
 * 送信すると GitHub の Issue フォームが開く。熱量の上限は Actions 側で判定する
 * （GitHub アカウント単位なので、クライアントでは正しく数えられないため）。
 */

import React from 'react';
import type { EquipmentDef } from '@/core/types';
import { MAX_HEAT_PER_USER } from '@/core/types';
import { HEAT_LEVELS, REQUEST_OPTIONS } from '@/core/constants';
import { modelsOf, seriesOf } from '@/core/logic/equipment';
import { Button, Field, Select } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

export interface RequestFormState {
  heat: number;
  season: string;
  timeOfDay: string;
  atmosphere: string;
  manufacturer: string;
  series: string;
  model: string;
}

export const EMPTY_REQUEST_FORM: RequestFormState = {
  heat: 1,
  season: REQUEST_OPTIONS.season[0],
  timeOfDay: REQUEST_OPTIONS.timeOfDay[0],
  atmosphere: REQUEST_OPTIONS.atmosphere[0],
  manufacturer: '',
  series: '',
  model: '',
};

interface RequestFormProps {
  form: RequestFormState;
  equipment: EquipmentDef[];
  loading: boolean;
  onChange: (patch: Partial<RequestFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function RequestForm({
  form,
  equipment,
  loading,
  onChange,
  onSubmit,
  onCancel,
}: RequestFormProps) {
  const { t } = useI18n();
  const toOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded bg-amber-50 p-2 text-[11px] text-amber-800">
        1 アカウントあたりの熱量は合計 {MAX_HEAT_PER_USER} までです。超過分は自動で差し戻されます。
      </p>

      <Field label={t.form.reqHeat}>
        <Select
          value={String(form.heat)}
          options={HEAT_LEVELS.map((n) => ({ value: String(n), label: '🔥'.repeat(n) }))}
          onChange={(e) => onChange({ heat: Number(e.target.value) })}
        />
      </Field>

      <Field label={t.form.reqSeason}>
        <Select
          value={form.season}
          options={toOptions(REQUEST_OPTIONS.season)}
          onChange={(e) => onChange({ season: e.target.value })}
        />
      </Field>

      <Field label={t.form.reqTime}>
        <Select
          value={form.timeOfDay}
          options={toOptions(REQUEST_OPTIONS.timeOfDay)}
          onChange={(e) => onChange({ timeOfDay: e.target.value })}
        />
      </Field>

      <Field label={t.form.reqAtmosphere}>
        <Select
          value={form.atmosphere}
          options={toOptions(REQUEST_OPTIONS.atmosphere)}
          onChange={(e) => onChange({ atmosphere: e.target.value })}
        />
      </Field>

      <div className="flex flex-col gap-2 rounded border border-gray-100 bg-gray-50 p-2">
        <span className="text-[11px] font-bold text-gray-500">{t.form.equipment}</span>
        <Select
          value={form.manufacturer}
          options={[
            { value: '', label: t.form.selectMaker },
            ...equipment.map((d) => ({ value: d.manufacturer, label: d.manufacturer })),
          ]}
          onChange={(e) => onChange({ manufacturer: e.target.value, series: '', model: '' })}
        />
        <Select
          value={form.series}
          disabled={!form.manufacturer}
          options={[
            { value: '', label: t.form.selectSeries },
            ...seriesOf(equipment, form.manufacturer).map((s) => ({ value: s, label: s })),
          ]}
          onChange={(e) => onChange({ series: e.target.value, model: '' })}
        />
        <Select
          value={form.model}
          disabled={!form.series}
          options={[
            { value: '', label: t.form.selectModel },
            ...modelsOf(equipment, form.manufacturer, form.series).map((m) => ({ value: m, label: m })),
          ]}
          onChange={(e) => onChange({ model: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onSubmit} disabled={loading}>
          <i className="fa-brands fa-github mr-1.5" />
          {t.contribute.submitRequest}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {t.form.cancel}
        </Button>
      </div>
    </div>
  );
}
