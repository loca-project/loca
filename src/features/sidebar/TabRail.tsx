/**
 * サイドメニューのアイコン列（要件 2.3 / 2.4）。
 * 開閉アイコンもタブアイコンと同じサイズにして、視覚的な一貫性を保つ。
 */

import React from 'react';
import { TabMode } from '@/core/types';
import { useI18n } from '@/shared/hooks/useI18n';

type TabLabelKey = 'map' | 'request' | 'region' | 'channel' | 'gear';

export const TAB_ICONS: { mode: TabMode; icon: string; labelKey: TabLabelKey }[] = [
  { mode: TabMode.MAP, icon: 'fa-map', labelKey: 'map' },
  { mode: TabMode.RANKING_REQUEST, icon: 'fa-fire', labelKey: 'request' },
  { mode: TabMode.RANKING_REGION, icon: 'fa-location-dot', labelKey: 'region' },
  { mode: TabMode.RANKING_CHANNEL, icon: 'fa-tv', labelKey: 'channel' },
  { mode: TabMode.RANKING_EQUIPMENT, icon: 'fa-camera', labelKey: 'gear' },
];

interface TabRailProps {
  current: TabMode;
  expanded: boolean;
  onSelect: (tab: TabMode) => void;
  onToggle: () => void;
}

const ICON_BUTTON = 'flex h-11 w-11 items-center justify-center rounded-lg text-lg transition';

export default function TabRail({ current, expanded, onSelect, onToggle }: TabRailProps) {
  const { t } = useI18n();

  return (
    <nav
      className="z-40 flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3 shadow-sm"
      aria-label={t.sidebar.map}
    >
      <button
        type="button"
        onClick={onToggle}
        title={expanded ? t.sidebar.collapse : t.sidebar.expand}
        aria-label={expanded ? t.sidebar.collapse : t.sidebar.expand}
        className={`${ICON_BUTTON} mb-1 text-gray-500 hover:bg-gray-100`}
      >
        <i className={`fa-solid ${expanded ? 'fa-angles-left' : 'fa-bars'}`} />
      </button>

      {TAB_ICONS.map((tab) => {
        const active = current === tab.mode;
        return (
          <button
            key={tab.mode}
            type="button"
            onClick={() => onSelect(tab.mode)}
            title={t.sidebar[tab.labelKey]}
            aria-label={t.sidebar[tab.labelKey]}
            aria-current={active}
            className={`${ICON_BUTTON} ${
              active ? 'bg-loca-50 text-loca-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
          </button>
        );
      })}
    </nav>
  );
}
