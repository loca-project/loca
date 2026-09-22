/** 範囲指定検索の矩形レイヤ定義。アダプタ本体を薄く保つために分離。 */

import type { Bounds } from '@/core/types';

export const RECT_SOURCE = 'loca-rect';
export const RECT_FILL = 'loca-rect-fill';
export const RECT_LINE = 'loca-rect-line';

export interface RectFeatureCollection {
  type: 'FeatureCollection';
  features: unknown[];
}

export function boundsToFeatureCollection(bounds: Bounds | null): RectFeatureCollection {
  if (!bounds) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [bounds.west, bounds.south],
              [bounds.east, bounds.south],
              [bounds.east, bounds.north],
              [bounds.west, bounds.north],
              [bounds.west, bounds.south],
            ],
          ],
        },
      },
    ],
  };
}

/**
 * スタイル URL が読めなかったときの最終手段。
 * 外部に一切依存せず、背景色だけの地図を出して操作を継続させる。
 */
export function blankStyle() {
  return {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background' as const,
        paint: { 'background-color': '#e8edf3' },
      },
    ],
  };
}
