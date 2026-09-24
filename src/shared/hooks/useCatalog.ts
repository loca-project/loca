/**
 * 公開データの読み込み（要件 1.4 のハイブリッド）。
 * 1. 起動時に markers.json（前日のバッチで作った確定データ）を読む。
 * 2. Firebase が使える構成なら、その同期時刻（syncedAt）より後に変わったマーカーを onSnapshot で購読し、一覧に合流させる。
 * 自分の保存直後は upsertMarker / removeMarker でも直す（購読が届く前に地図へ出すため。同じ ID なら上書きされる）。
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
  const { catalog, markerStore } = useServices();
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [requestMarkers, setRequestMarkers] = useState<RequestMarkerData[]>([]);
  const [equipment, setEquipment] = useState<EquipmentDef[]>([]);
  const [generatedAt, setGeneratedAt] = useState(0);
  const [syncedAt, setSyncedAt] = useState(0);
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
        setSyncedAt(snapshot.syncedAt);
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

  // ベースを読み終えてから差分の購読を始める（syncedAt が決まってから）
  useEffect(() => {
    if (!markerStore || loading) return undefined;
    return markerStore.subscribeChanges(
      syncedAt,
      (changed) => {
        setMarkers((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const m of changed) {
            if (m.deleted) byId.delete(m.id);
            else byId.set(m.id, m);
          }
          return [...byId.values()];
        });
      },
      (e) => {
        console.error('[loca] 差分の購読に失敗しました', e);
        setHealth({ notice: '最新の登録を受け取れませんでした。再読み込みすると直ることがあります。' });
      },
    );
  }, [markerStore, loading, syncedAt]);

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
