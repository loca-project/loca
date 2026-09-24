/**
 * 画面下に常設する地図フィルター（ADR 0015）。どのタブを開いていても操作できる。
 * どの画面幅でも「フィルター」ボタン 1 つだけを置き、条件はすべてボタンで開くパネルの中に入れる（T50）。
 * 地図の出典表示とズームボタンを隠さないよう、下端から少し上げ、右端を空ける。
 */

import React, { useState } from 'react';
import type { MapFilter } from '@/core/types';
import { DEFAULT_MAP_FILTER } from '@/core/types';
import { activeFilterCount } from '@/core/logic/mapFilter';
import { ToggleChip } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filter);

  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-start transition-[left] duration-200"
      style={{ left, right: FILTER_BAR_RIGHT, bottom: FILTER_BAR_BOTTOM }}
    >
      {open && (
        <MapFilterSheet
          filter={filter}
          shown={shown}
          total={total}
          onChange={onChange}
          onClear={() => onChange(DEFAULT_MAP_FILTER)}
          onClose={() => setOpen(false)}
        />
      )}
      <div role="toolbar" aria-label={t.mapFilter.label} className="pointer-events-auto">
        <ToggleChip
          active={open || count > 0}
          icon="fa-solid fa-sliders"
          label={t.mapFilter.more}
          badge={count}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        />
      </div>
    </div>
  );
}
