/** マーカーと撮影リクエストから地図のピン配列を組み立てる。 */

import { useMemo } from 'react';
import type { MarkerData, RequestMarkerData } from '@/core/types';
import type { MapPinOptions } from '@/ports';
import { REQUEST_HEX, emotionColor } from '@/core/constants';

export function usePins(
  markers: MarkerData[],
  requestMarkers: RequestMarkerData[],
  onMarkerClick: (marker: MarkerData) => void,
  onRequestClick: (marker: RequestMarkerData) => void,
): MapPinOptions[] {
  return useMemo(() => {
    const markerPins: MapPinOptions[] = markers.map((m) => ({
      id: `m_${m.id}`,
      position: { lat: m.lat, lng: m.lng },
      // 要件 3.3: マーカー色は「感情の核」に対応する
      color: emotionColor(m.tags?.emotion),
      onClick: () => onMarkerClick(m),
    }));

    const requestPins: MapPinOptions[] = requestMarkers.map((r) => ({
      id: `r_${r.id}`,
      position: { lat: r.lat, lng: r.lng },
      color: REQUEST_HEX,
      label: String(r.totalHeat),
      zIndex: 10,
      onClick: () => onRequestClick(r),
    }));

    return [...markerPins, ...requestPins];
  }, [markers, requestMarkers, onMarkerClick, onRequestClick]);
}
