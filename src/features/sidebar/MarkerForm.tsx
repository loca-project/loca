/**
 * マーカー投稿フォーム（要件 3.3）。
 * 入力の並びは要件どおり URL → タグ（必須 → 任意）→ 現地メモ → GPS → 撮影機器。
 * 送信すると Firestore に保存し、すぐ地図に出る。
 */

import React from 'react';
import type { EquipmentDef } from '@/core/types';
import { MEMO_MAX_LENGTH, TAG_CATEGORIES, type TagCategory } from '@/core/constants';
import { Button, Field, RadioGroup, TextInput } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { interpolate } from '@/core/logic/format';
import type { MarkerFormState } from '@/features/marker/formState';
import { chipOptions } from '@/features/tags/tagChips';
import EquipmentSelects from '@/features/equipment/EquipmentSelects';

/** 緯度・経度の矢印 1 回ぶんの刻み（度）。移植元 Chronos MAP の MarkerForm と同じ */
const COORD_STEP = 0.0001;

interface MarkerFormProps {
  form: MarkerFormState;
  equipment: EquipmentDef[];
  loading: boolean;
  onChange: (patch: Partial<MarkerFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** 既存マーカーの編集中か */
  editing: boolean;
}

export default function MarkerForm({
  form,
  equipment,
  loading,
  onChange,
  onSubmit,
  onCancel,
  editing,
}: MarkerFormProps) {
  const { t, lang } = useI18n();
  const submitLabel = editing ? t.store.update : t.store.submit;

  const tagChips = (category: TagCategory, optional: boolean) => (
    <RadioGroup
      name={category.field}
      options={chipOptions(category, lang)}
      value={form.tags[category.field]}
      allowDeselect={optional}
      onChange={(v) => onChange({ tags: { ...form.tags, [category.field]: v } })}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 撮影リクエストの地点から来た新規登録（ADR 0028） */}
      {!editing && form.answers && form.answers.length > 0 && (
        <p className="rounded bg-orange-50 px-2 py-1.5 text-[11px] text-orange-800">
          <i className="fa-solid fa-fire mr-1" />
          {interpolate(t.answers.formBanner, { count: form.answers.length })}
        </p>
      )}
      <Field label={t.form.url}>
        <TextInput
          value={form.youtubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          onChange={(e) => onChange({ youtubeUrl: e.target.value })}
        />
      </Field>

      {TAG_CATEGORIES.filter((c) => c.required).map((category) => (
        <Field key={category.field} label={`${t.tags[category.field]} (${t.tags.required})`}>
          {tagChips(category, false)}
        </Field>
      ))}

      <div className="flex flex-col gap-3 rounded border border-gray-100 bg-gray-50 p-2">
        <span className="text-[11px] font-bold text-gray-500">
          {t.tags.optionalGroup}
          <span className="ml-1 font-normal">{t.tags.optionalHint}</span>
        </span>
        {TAG_CATEGORIES.filter((c) => !c.required).map((category) => (
          <Field key={category.field} label={t.tags[category.field]}>
            {tagChips(category, true)}
          </Field>
        ))}
      </div>

      <Field label={`${t.tags.memo} (${t.tags.optional}) ${[...form.memo].length}/${MEMO_MAX_LENGTH}`}>
        <TextInput
          value={form.memo}
          maxLength={MEMO_MAX_LENGTH}
          placeholder={t.tags.memoPlaceholder}
          onChange={(e) => onChange({ memo: e.target.value })}
        />
      </Field>

      {/* 矢印（スピンボタン・上下キー）で少しずつ動かせる。刻みは移植元と同じ 0.0001 度（約 10 m） */}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t.form.lat}>
          <TextInput
            type="number"
            step={COORD_STEP}
            value={form.lat}
            inputMode="decimal"
            onChange={(e) => onChange({ lat: e.target.value })}
          />
        </Field>
        <Field label={t.form.lng}>
          <TextInput
            type="number"
            step={COORD_STEP}
            value={form.lng}
            inputMode="decimal"
            onChange={(e) => onChange({ lng: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded border border-gray-100 bg-gray-50 p-2">
        <span className="text-[11px] font-bold text-gray-500">{t.form.equipment}</span>
        <EquipmentSelects
          defs={equipment}
          value={form.equipment}
          mode="input"
          onChange={(next) => onChange({ equipment: next })}
        />
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onSubmit} disabled={loading}>
          <i className="fa-solid fa-floppy-disk mr-1.5" />
          {loading ? t.contribute.checking : submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {t.form.cancel}
        </Button>
      </div>

      <p className="rounded bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-500">
        <i className="fa-solid fa-circle-info mr-1" />
        {t.store.note}
      </p>
    </div>
  );
}
