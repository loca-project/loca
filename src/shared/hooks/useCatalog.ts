/**
 * 公開データの読み込み。
 * データベースを持たないので購読は無く、起動時に 1 回読むだけ。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EquipmentDef, MarkerData, RequestMarkerData } from '@/core/types';
import { setHealth } from '@/runtime/health';
import { useServices } from './useServices';

export interface Catalog {
  markers: MarkerData[];
  requestMarkers: RequestMarkerData[];
  equipment: EquipmentDef[];
  /** 公開データが生成された時刻（epoch ms）。0 なら不明 */
  generatedAt: number;
  loading: boolean;
  reload: () => void;
}

export function useCatalog(): Catalog {
  const { catalog } = useServices();
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [requestMarkers, setRequestMarkers] = useState<RequestMarkerData[]>([]);
  const [equipment, setEquipment] = useState<EquipmentDef[]>([]);
  const [generatedAt, setGeneratedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void catalog
      .load()
      .then((snapshot) => {
        if (cancelled) return;
        setMarkers(snapshot.markers);
        setRequestMarkers(snapshot.requestMarkers);
        setEquipment(snapshot.equipment);
        setGeneratedAt(snapshot.generatedAt);
        setHealth({
          generatedAt: snapshot.generatedAt,
          dataUnavailable: snapshot.markers.length === 0 && snapshot.equipment.length === 0,
        });
      })
      .catch((e: unknown) => {
        console.error('[loca] 公開データを読み込めませんでした', e);
        setHealth({ dataUnavailable: true, notice: '公開データを読み込めませんでした。' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [catalog, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return useMemo(
    () => ({ markers, requestMarkers, equipment, generatedAt, loading, reload }),
    [markers, requestMarkers, equipment, generatedAt, loading, reload],
  );
}
