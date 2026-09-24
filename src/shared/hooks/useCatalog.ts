/**
 * 公開データの読み込み。起動時に markers.json を 1 回読む。
 * Firestore に保存した直後は upsertMarker / removeMarker で手元の一覧だけを直す（再読み込みなしで地図に出すため）。
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
  /** 保存したマーカーを手元の一覧に反映する（同じ ID があれば置き換える）。 */
  upsertMarker: (marker: MarkerData) => void;
  /** 論理削除したマーカーを手元の一覧から外す。 */
  removeMarker: (id: string) => void;
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
  const upsertMarker = useCallback((marker: MarkerData) => {
    setMarkers((prev) => [marker, ...prev.filter((m) => m.id !== marker.id)]);
  }, []);
  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return useMemo(
    () => ({ markers, requestMarkers, equipment, generatedAt, loading, reload, upsertMarker, removeMarker }),
    [markers, requestMarkers, equipment, generatedAt, loading, reload, upsertMarker, removeMarker],
  );
}
