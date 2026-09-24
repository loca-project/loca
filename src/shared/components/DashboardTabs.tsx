/**
 * 大きな画面（統計とエクスポート・自分の投稿）の上に並べるタブ。
 * 同じ見た目にそろえるため、画面ごとに書かずにここを使う。
 * 高さ・角丸・文字の大きさはほかの操作部品（Controls の CONTROL = h-9）にそろえ、選んでいないタブにも背景を付けてタブと分かるようにする。
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
    <nav role="tablist" className="mb-4 flex flex-wrap gap-1.5 border-b border-gray-100 pb-3">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={`inline-flex h-9 items-center rounded-md px-3 text-xs font-bold transition ${
            value === item.id ? 'bg-loca-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <i className={`fa-solid ${item.icon} mr-1.5`} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
