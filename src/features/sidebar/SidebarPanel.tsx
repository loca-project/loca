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
      {/* 開閉ボタンの横に「Loca │ メニュー名」を 1 行で並べる（ADR 0027）。上 12px ＋ 44px の行で中心を開閉ボタンとそろえる。
          スマホでは右上のログインボタンが重なるので、画面が狭いほど右の余白を広げてメニュー名を「…」で切る */}
      <header
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-gray-100 pl-4 pt-3"
        style={{ paddingRight: 'max(1rem, calc(460px - 100vw))' }}
      >
        <span className="shrink-0 font-wordmark text-2xl leading-none tracking-[-0.01em] text-loca-700">Loca</span>
        <span aria-hidden className="h-[18px] w-px shrink-0 bg-gray-300" />
        <h2 className="min-w-0 truncate text-xs font-bold text-gray-700">{title}</h2>
      </header>
      <div className="grow overflow-y-auto px-4 py-4">{children}</div>
    </aside>
  );
}
