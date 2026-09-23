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

export const GSI_SOURCE = 'gsi-pale';

/**
 * 地理院タイル（淡色地図）のスタイル（ADR 0011）。
 *
 * - 淡色地図はズーム 2〜18 で配信される（z0・z1 は 404 を実測）。19 以上は 18 を拡大表示する
 * - 出典の明示と地理院タイル一覧へのリンクが利用条件
 * - 背景色を敷いておくので、タイルが読めない区画は灰色になり操作は続けられる
 */
export function gsiStyle() {
  return {
    version: 8 as const,
    sources: {
      [GSI_SOURCE]: {
        type: 'raster' as const,
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 18,
        attribution:
          '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background' as const,
        paint: { 'background-color': '#e8edf3' },
      },
      { id: GSI_SOURCE, type: 'raster' as const, source: GSI_SOURCE },
    ],
  };
}
