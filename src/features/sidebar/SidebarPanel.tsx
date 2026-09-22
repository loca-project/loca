/**
 * サイドメニュー本体の器。
 * 地図の上にオーバーレイし、開閉でスライドする（要件 2.3）。
 */

import React from 'react';

export const SIDEBAR_RAIL_WIDTH = 56;
export const SIDEBAR_PANEL_WIDTH = 288;

interface SidebarPanelProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
}

export default function SidebarPanel({ open, title, children }: SidebarPanelProps) {
  return (
    <aside
      aria-hidden={!open}
      className="absolute bottom-0 top-0 z-30 flex flex-col overflow-hidden border-r border-gray-200 bg-white shadow-lg transition-all duration-200"
      style={{
        left: SIDEBAR_RAIL_WIDTH,
        width: open ? SIDEBAR_PANEL_WIDTH : 0,
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <header className="shrink-0 border-b border-gray-100 px-4 py-3">
        <h2 className="text-xs font-bold text-gray-700">{title}</h2>
      </header>
      <div className="grow overflow-y-auto px-4 py-4">{children}</div>
    </aside>
  );
}
