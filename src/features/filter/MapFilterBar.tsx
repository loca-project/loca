/**
 * 画面下に常設する地図フィルタ（ADR 0015）。どのタブを開いていても操作できる。
 * 常に見える列: 動画／撮影リクエストの切り替え、雰囲気 6 色（凡例を兼ねる）、「絞り込み」。
 * 地図の出典表示とズームボタンを隠さないよう、下端から少し上げ、右端を空ける。
 */

import React, { useState } from 'react';
import type { MapFilter } from '@/core/types';
import { DEFAULT_MAP_FILTER } from '@/core/types';
import { activeFilterCount } from '@/core/logic/mapFilter';
import { ToggleChip } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { categoryOf, chipOptions } from '@/features/tags/tagChips';
import MapFilterSheet from './MapFilterSheet';

/** 右端に空ける幅（ズームボタンの列）と、下端からの高さ（出典表示の帯）。 */
export const FILTER_BAR_RIGHT = 52;
const FILTER_BAR_BOTTOM = 'calc(34px + env(safe-area-inset-bottom))';

interface MapFilterBarProps {
  filter: MapFilter;
  onChange: (next: MapFilter) => void;
  /** 左端の位置（サイドメニューと結果パネルの右） */
  left: number;
  /** 地図に出ている動画の数と全体の数 */
  shown: number;
  total: number;
}

export default function MapFilterBar({ filter, onChange, left, shown, total }: MapFilterBarProps) {
  const { t, lang } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const moods = filter.tags.mood ?? [];
  const toggleMood = (key: string) =>
    onChange({
      ...filter,
      tags: { ...filter.tags, mood: moods.includes(key) ? moods.filter((m) => m !== key) : [...moods, key] },
    });
  // 雰囲気は列に出ているので、ボタンの数字は列に無い条件だけを数える
  const hiddenCount = activeFilterCount({ ...filter, tags: { ...filter.tags, mood: [] } });

  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-start transition-[left] duration-200"
      style={{ left, right: FILTER_BAR_RIGHT, bottom: FILTER_BAR_BOTTOM }}
    >
      {sheetOpen && (
        <MapFilterSheet
          filter={filter}
          shown={shown}
          total={total}
          onChange={onChange}
          onClear={() => onChange(DEFAULT_MAP_FILTER)}
          onClose={() => setSheetOpen(false)}
        />
      )}
      <div role="toolbar" aria-label={t.mapFilter.label} className="pointer-events-auto flex max-w-full gap-1.5">
        {/* 「絞り込み」は狭い画面でも隠れないよう、スクロールしない左端に置く */}
        <ToggleChip
          active={sheetOpen}
          icon="fa-solid fa-sliders"
          label={t.mapFilter.more}
          badge={hiddenCount}
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(!sheetOpen)}
          className="my-0.5"
        />
        {/* 右端を薄くして、横にスクロールできることを示す */}
        <div className="flex min-w-0 gap-1.5 overflow-x-auto p-0.5 pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none]">
          <ToggleChip
            active={filter.videos}
            icon="fa-brands fa-youtube"
            label={t.mapFilter.videos}
            onClick={() => onChange({ ...filter, videos: !filter.videos })}
          />
          <ToggleChip
            active={filter.requests}
            icon="fa-solid fa-fire"
            label={t.mapFilter.requests}
            onClick={() => onChange({ ...filter, requests: !filter.requests })}
          />
          {chipOptions(categoryOf('mood'), lang).map((o) => (
            <ToggleChip
              key={o.value}
              active={moods.includes(o.value)}
              color={o.color}
              label={o.label ?? o.value}
              onClick={() => toggleMood(o.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
