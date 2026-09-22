/**
 * ランキングの共通フィルタ＋個別フィルタ（要件 4.2 / 4.3）。
 * 変更しただけでは集計せず、「適用」を押したときだけ実行する。
 */

import React from 'react';
import type { EquipmentDef, RankingFilter, TabMode } from '@/core/types';
import { TabMode as Tab } from '@/core/types';
import { PREFECTURES, REQUEST_OPTIONS, TAG_CATEGORIES } from '@/core/constants';
import { modelsOf, seriesOf } from '@/core/logic/equipment';
import { Button, CheckboxGroup, Field, Select } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface RankingFiltersProps {
  tab: TabMode;
  filter: RankingFilter;
  equipment: EquipmentDef[];
  loading: boolean;
  onChange: (patch: Partial<RankingFilter>) => void;
  onApply: () => void;
}

export default function RankingFilters({
  tab,
  filter,
  equipment,
  loading,
  onChange,
  onApply,
}: RankingFiltersProps) {
  const { t } = useI18n();
  const eq = filter.equipment ?? { manufacturer: '', series: '', model: '' };

  const periodOptions = [
    { value: 'all', label: t.filters.allTime },
    { value: '1y', label: t.filters.pastYear },
    { value: '6m', label: t.filters.past6m },
    { value: '3m', label: t.filters.past3m },
    { value: '1m', label: t.filters.past1m },
    { value: '2w', label: t.filters.past2w },
    { value: 'today', label: t.filters.today },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Field label={t.filters.registeredRange}>
        <Select
          value={filter.period}
          options={periodOptions}
          onChange={(e) => onChange({ period: e.target.value as RankingFilter['period'] })}
        />
      </Field>

      <div className="flex flex-col gap-2 rounded border border-gray-100 bg-gray-50 p-2">
        <span className="text-[11px] font-bold text-gray-500">{t.filters.tags}</span>
        {TAG_CATEGORIES.map((c) => (
          <div key={c.key}>
            <p className="mb-1 text-[10px] text-gray-400">
              {t.filters[c.labelKey as keyof typeof t.filters] as string}
            </p>
            <CheckboxGroup
              options={c.options}
              values={filter.tags.filter((tag) => c.options.includes(tag))}
              onChange={(next) => {
                const others = filter.tags.filter((tag) => !c.options.includes(tag));
                onChange({ tags: [...others, ...next] });
              }}
            />
          </div>
        ))}
      </div>

      {tab === Tab.RANKING_REGION && (
        <>
          <Field label={t.filters.prefecture}>
            <Select
              value={filter.prefecture ?? ''}
              options={[
                { value: '', label: t.filters.allJapan },
                ...PREFECTURES.map((p) => ({ value: p, label: p })),
              ]}
              onChange={(e) => onChange({ prefecture: e.target.value || undefined })}
            />
          </Field>
          <Field label={t.filters.season}>
            <Select
              value={filter.season ?? ''}
              options={[
                { value: '', label: t.filters.allSeasons },
                { value: '1-3', label: t.filters.q1 },
                { value: '4-6', label: t.filters.q2 },
                { value: '7-9', label: t.filters.q3 },
                { value: '10-12', label: t.filters.q4 },
              ]}
              onChange={(e) => onChange({ season: (e.target.value || undefined) as RankingFilter['season'] })}
            />
          </Field>
        </>
      )}

      {tab === Tab.RANKING_REQUEST && (
        <>
          <Field label={t.filters.timeOfDay}>
            <Select
              value={filter.timeOfDay ?? ''}
              options={[
                { value: '', label: t.filters.allTimes },
                ...REQUEST_OPTIONS.timeOfDay.slice(1).map((v) => ({ value: v, label: v })),
              ]}
              onChange={(e) => onChange({ timeOfDay: e.target.value || undefined })}
            />
          </Field>
          <Field label={t.filters.atmosphere}>
            <Select
              value={filter.atmosphere ?? ''}
              options={[
                { value: '', label: t.filters.allAtmospheres },
                ...REQUEST_OPTIONS.atmosphere.slice(1).map((v) => ({ value: v, label: v })),
              ]}
              onChange={(e) => onChange({ atmosphere: e.target.value || undefined })}
            />
          </Field>
        </>
      )}

      {tab === Tab.RANKING_EQUIPMENT && (
        <div className="flex flex-col gap-2 rounded border border-loca-100 bg-loca-50 p-2">
          <span className="text-[11px] font-bold text-loca-700">{t.filters.equipmentFilter}</span>
          <Select
            value={eq.manufacturer}
            options={[
              { value: '', label: t.filters.allMakers },
              ...equipment.map((d) => ({ value: d.manufacturer, label: d.manufacturer })),
            ]}
            onChange={(e) =>
              onChange({ equipment: { manufacturer: e.target.value, series: '', model: '' } })
            }
          />
          <Select
            value={eq.series}
            disabled={!eq.manufacturer}
            options={[
              { value: '', label: t.filters.any },
              ...seriesOf(equipment, eq.manufacturer).map((s) => ({ value: s, label: s })),
            ]}
            onChange={(e) => onChange({ equipment: { ...eq, series: e.target.value, model: '' } })}
          />
          <Select
            value={eq.model}
            disabled={!eq.series}
            options={[
              { value: '', label: t.filters.any },
              ...modelsOf(equipment, eq.manufacturer, eq.series).map((m) => ({ value: m, label: m })),
            ]}
            onChange={(e) => onChange({ equipment: { ...eq, model: e.target.value } })}
          />
        </div>
      )}

      <Field label={t.filters.limit}>
        <Select
          value={String(filter.limit)}
          options={[30, 20, 10].map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(e) => onChange({ limit: Number(e.target.value) as RankingFilter['limit'] })}
        />
      </Field>

      <Button onClick={onApply} disabled={loading}>
        {loading ? t.form.processing : t.form.apply}
      </Button>
    </div>
  );
}
