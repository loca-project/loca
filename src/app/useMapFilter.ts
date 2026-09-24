/** 画面下の地図フィルタの状態と、絞り込んだ後のマーカー（ADR 0015）。 */

import { useMemo, useState } from 'react';
import type { MapFilter, MarkerData, RequestMarkerData } from '@/core/types';
import { DEFAULT_MAP_FILTER } from '@/core/types';
import { filterMarkersForMap, filterRequestsForMap } from '@/core/logic/mapFilter';

export function useMapFilter(markers: MarkerData[], requestMarkers: RequestMarkerData[]) {
  const [filter, setFilter] = useState<MapFilter>(DEFAULT_MAP_FILTER);
  const visibleMarkers = useMemo(() => filterMarkersForMap(markers, filter), [markers, filter]);
  const visibleRequests = useMemo(() => filterRequestsForMap(requestMarkers, filter), [requestMarkers, filter]);
  return { filter, setFilter, markers: visibleMarkers, requestMarkers: visibleRequests };
}
