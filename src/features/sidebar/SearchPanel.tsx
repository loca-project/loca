/**
 * 検索モードのサイドメニュー（要件 3.1 / 3.1.3）。
 * 地図検索とマーカー検索をトグルで切り替え、範囲指定中は入力を無効化する。
 * マーカー検索では AI 検索（ADR 0033）を入れられる。既定は切で、入れている間は初回に読む大きさを案内する。
 */

import React from 'react';
import { Button, Checkbox, Field, Segmented, TextInput } from '@/shared/components/Controls';
import { interpolate } from '@/core/logic/format';
import { useI18n } from '@/shared/hooks/useI18n';

export type SearchTarget = 'map' | 'marker';

/** AI 検索の状態（src/app/useAiSearch.ts の AiSearch と同じ形。features から app を import しないため型を分ける） */
export interface SearchPanelAi {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  sizeMb: number;
  progress: number | null | undefined;
}

interface SearchPanelProps {
  target: SearchTarget;
  query: string;
  loading: boolean;
  drawing: boolean;
  hasRectangle: boolean;
  ai: SearchPanelAi;

  onTargetChange: (t: SearchTarget) => void;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onStartDrawing: () => void;
  onClearRectangle: () => void;
}

export default function SearchPanel({
  target,
  query,
  loading,
  drawing,
  hasRectangle,
  ai,

  onTargetChange,
  onQueryChange,
  onSearch,
  onStartDrawing,
  onClearRectangle,
}: SearchPanelProps) {
  const { t } = useI18n();
  // 要件 3.1.3: 範囲指定モード中・矩形描画中はテキスト検索を無効化する
  const textDisabled = drawing || hasRectangle;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={target}
        disabled={textDisabled}
        onChange={onTargetChange}
        options={[
          { value: 'map', label: t.form.mapTab },
          { value: 'marker', label: t.form.markerTab },
        ]}
      />

      <Field label={t.form.keyword}>
        <TextInput
          value={query}
          disabled={textDisabled}
          placeholder={t.form.searchPlaceholder}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !textDisabled) onSearch();
          }}
        />
      </Field>

      {target === 'marker' && (
        <div>
          <Checkbox checked={ai.enabled} onChange={ai.setEnabled}>
            {t.form.aiSearch}
          </Checkbox>
          {ai.enabled && (
            <p className="ml-6 mt-1 text-[11px] leading-relaxed text-gray-500">{interpolate(t.form.aiSearchNote, { mb: ai.sizeMb })}</p>
          )}
        </div>
      )}

      <Button onClick={onSearch} disabled={loading || textDisabled}>
        <i className="fa-solid fa-magnifying-glass mr-1.5" />
        {ai.progress !== undefined
          ? interpolate(t.form.aiLoading, { pct: ai.progress === null ? '' : `${Math.round(ai.progress * 100)}%` })
          : loading
            ? t.form.processing
            : t.form.search}
      </Button>

      <div className="border-t border-gray-100 pt-3">
        {hasRectangle || drawing ? (
          <Button variant="secondary" className="w-full" onClick={onClearRectangle}>
            <i className="fa-solid fa-eraser mr-1.5" />
            {t.form.clearArea}
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" onClick={onStartDrawing}>
            <i className="fa-solid fa-vector-square mr-1.5" />
            {t.form.selectArea}
          </Button>
        )}
        {drawing && (
          <p className="mt-2 text-[11px] text-loca-700">
            地図上をドラッグして範囲を描いてください。指を離すと検索します。
          </p>
        )}
      </div>

      <p className="rounded bg-gray-50 p-2 text-[11px] text-gray-500">
        <i className="fa-solid fa-circle-info mr-1" />
        {t.form.clickHint}
      </p>
    </div>
  );
}
