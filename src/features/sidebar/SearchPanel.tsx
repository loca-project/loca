/**
 * 検索モードのサイドメニュー（要件 3.1 / 3.1.3）。
 * 地図検索とマーカー検索をトグルで切り替え、範囲指定中は入力を無効化する。
 */

import React from 'react';
import { Button, Field, TextInput } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

export type SearchTarget = 'map' | 'marker';

interface SearchPanelProps {
  target: SearchTarget;
  query: string;
  loading: boolean;
  drawing: boolean;
  hasRectangle: boolean;

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
      <div className="grid grid-cols-2 overflow-hidden rounded border border-gray-300 text-xs">
        {(['map', 'marker'] as SearchTarget[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onTargetChange(value)}
            disabled={textDisabled}
            className={`py-1.5 font-bold transition disabled:text-gray-300 ${
              target === value ? 'bg-loca-500 text-white' : 'bg-white text-gray-600'
            }`}
          >
            {value === 'map' ? t.form.mapTab : t.form.markerTab}
          </button>
        ))}
      </div>

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

      <Button onClick={onSearch} disabled={loading || textDisabled}>
        <i className="fa-solid fa-magnifying-glass mr-1.5" />
        {loading ? t.form.processing : t.form.search}
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
