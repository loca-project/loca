/**
 * 大きな画面（統計とエクスポート・自分の投稿）の上に並べるタブ。
 * 同じ見た目にそろえるため、画面ごとに書かずにここを使う。
 */

import React from 'react';

export interface DashboardTab<T extends string> {
  id: T;
  /** Font Awesome の solid アイコン名（fa- から） */
  icon: string;
  label: string;
}

export default function DashboardTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: DashboardTab<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-gray-100 pb-2">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={`rounded px-3 py-1.5 text-[11px] font-bold transition ${
            value === item.id ? 'bg-loca-500 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <i className={`fa-solid ${item.icon} mr-1.5`} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
