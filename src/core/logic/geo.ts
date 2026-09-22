/** 座標と矩形範囲の計算。 */

import type { Bounds, LatLng } from '@/core/types';

/** 日本列島がちょうど収まる初期表示範囲（要件 3.1）。 */
export const JAPAN_BOUNDS: Bounds = {
  north: 45.8,
  south: 24.0,
  east: 146.0,
  west: 122.9,
};

export const JAPAN_CENTER: LatLng = { lat: 36.5, lng: 137.5 };

/**
 * これ以上引けない下限。要件 3.1 の「世界地図以外を表示させない」はこれで担保する。
 * maxBounds で全世界を指定すると MapLibre の制約計算が壊れるため使わない。
 */
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 20;
/** 地図ジャンプ時のズーム（要件 3.6：14〜16 程度）。 */
export const JUMP_ZOOM = 15;

export function normalizeBounds(a: LatLng, b: LatLng): Bounds {
  return {
    north: Math.max(a.lat, b.lat),
    south: Math.min(a.lat, b.lat),
    east: Math.max(a.lng, b.lng),
    west: Math.min(a.lng, b.lng),
  };
}

export function isInsideBounds(point: LatLng, bounds: Bounds): boolean {
  return (
    point.lat <= bounds.north &&
    point.lat >= bounds.south &&
    point.lng <= bounds.east &&
    point.lng >= bounds.west
  );
}

/** 複数地点を包含する矩形。空配列なら null。 */
export function boundsOf(points: LatLng[]): Bounds | null {
  if (points.length === 0) return null;
  return points.reduce<Bounds>(
    (acc, p) => ({
      north: Math.max(acc.north, p.lat),
      south: Math.min(acc.south, p.lat),
      east: Math.max(acc.east, p.lng),
      west: Math.min(acc.west, p.lng),
    }),
    { north: points[0].lat, south: points[0].lat, east: points[0].lng, west: points[0].lng },
  );
}
