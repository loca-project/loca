/**
 * 地図フィルタのチップ列をどこに置くか（ADR 0015 決定 6）。他の部品と重ねないための計算。
 * 置けないとき（幅が足りない・登録や編集の途中）は null を返し、列を隠す。
 */

import { FILTER_BAR_RIGHT } from './MapFilterBar';

/** 結果パネルの幅。ResultsPanel の w-[min(28rem,calc(100vw-5.5rem))] と同じ。 */
const resultsPanelWidth = (viewport: number) => Math.min(448, viewport - 88);

/** 列を出すのに要る最小の幅（切り替え 2 つと「絞り込み」が見える程度）。 */
const MIN_BAR_WIDTH = 220;
const GAP = 8;

export interface FilterBarContext {
  viewportWidth: number;
  /** サイドメニュー（レール＋開いたパネル）の右端 */
  sidebarOffset: number;
  resultsOpen: boolean;
  /** 仮マーカーを出している（登録・編集の途中） */
  registering: boolean;
}

/** 列の左端（px）。置けなければ null。 */
export function filterBarLeft(ctx: FilterBarContext): number | null {
  if (ctx.registering) return null;
  const resultsRight = ctx.resultsOpen ? ctx.sidebarOffset + 10 + resultsPanelWidth(ctx.viewportWidth) : ctx.sidebarOffset;
  const left = resultsRight + GAP;
  return ctx.viewportWidth - FILTER_BAR_RIGHT - left >= MIN_BAR_WIDTH ? left : null;
}
