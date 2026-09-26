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

export const OSM_SOURCE = 'osm';

/**
 * OpenStreetMap の標準タイルのスタイル（ADR 0032）。
 *
 * - 使い方は OSM 財団のタイル利用規約（operations.osmfoundation.org/policies/tiles/）に従う:
 *   URL は tile.openstreetmap.org をそのまま使う、出典を地図の右下に出す、見ている範囲だけを読む（先読み・保存をしない）。
 *   Referer はブラウザが送る（Referrer-Policy で止めない）。キャッシュはブラウザの HTTP キャッシュに任せる
 * - ズーム 0〜19 で配信される。稼働の保証（SLA）は無い
 * - 背景色を敷いておくので、タイルが読めない区画は灰色になり操作は続けられる
 */
export function osmStyle() {
  return {
    version: 8 as const,
    sources: {
      [OSM_SOURCE]: {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background' as const,
        paint: { 'background-color': '#e8edf3' },
      },
      { id: OSM_SOURCE, type: 'raster' as const, source: OSM_SOURCE },
    ],
  };
}
