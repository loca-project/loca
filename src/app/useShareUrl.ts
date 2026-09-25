/**
 * 地図フィルタと選択中のマーカー・撮影リクエストを URL に映し、開いたときに戻す（T42・T84）。
 * URL の形は core/logic/shareUrl.ts。履歴は増やさず（replaceState）、今の URL を書き換えるだけにする。
 */

import { useEffect, useRef } from 'react';
import type { LatLng, MapFilter } from '@/core/types';
import { decodeSharedView, encodeSharedView, type SharedView } from '@/core/logic/shareUrl';
import type { LocaApp } from './useLocaApp';

/** 開いたときの URL に載っていた状態。描画の前に 1 回だけ読む */
export function readSharedView(): SharedView {
  return decodeSharedView(window.location.search);
}

/** URL の位置から撮影リクエストの地点を探すときの許容幅（度）。位置は小数 6 桁で載せるので、ずれは丸めの分だけ */
const SPOT_TOLERANCE = 0.0005;

export function useShareUrl(app: LocaApp, filter: MapFilter, initial: { markerId: string | null; requestAt?: LatLng | null }): void {
  /** URL に載っていて、まだ開いていないマーカーの ID。公開データが届いたら開く */
  const pending = useRef(initial.markerId);
  /** 同じく、まだ開いていない撮影リクエストの位置（T84） */
  const pendingRequest = useRef(initial.markerId ? null : initial.requestAt ?? null);
  const { catalog, handleMarkerClick, handleRequestClick, jumpTo } = app;

  useEffect(() => {
    const id = pending.current;
    if (!id || catalog.loading) return;
    pending.current = null;
    const marker = catalog.markers.find((m) => m.id === id);
    if (!marker) {
      console.warn(`[loca] URL のマーカー ${id} が見つかりません（削除されたか、まだ同期されていません）`);
      return;
    }
    jumpTo({ lat: marker.lat, lng: marker.lng });
    handleMarkerClick(marker);
  }, [catalog.loading, catalog.markers, handleMarkerClick, jumpTo]);

  useEffect(() => {
    const at = pendingRequest.current;
    if (!at || catalog.loading) return;
    pendingRequest.current = null;
    const dist = (s: LatLng) => Math.abs(s.lat - at.lat) + Math.abs(s.lng - at.lng);
    const spot = catalog.requestMarkers
      .filter((s) => Math.abs(s.lat - at.lat) <= SPOT_TOLERANCE && Math.abs(s.lng - at.lng) <= SPOT_TOLERANCE)
      .sort((a, b) => dist(a) - dist(b))[0];
    if (!spot) {
      console.warn(`[loca] URL の撮影リクエスト（${at.lat}, ${at.lng}）が見つかりません（取り下げられたか、まだ同期されていません）`);
      return;
    }
    jumpTo({ lat: spot.lat, lng: spot.lng });
    handleRequestClick(spot);
  }, [catalog.loading, catalog.requestMarkers, handleRequestClick, jumpTo]);

  const selectedId = app.selectedMarker?.id ?? null;
  const selectedSpot = app.selectedRequest;
  const spotLat = selectedSpot?.lat;
  const spotLng = selectedSpot?.lng;
  useEffect(() => {
    // 開く前のマーカー・撮影リクエストは URL に残しておく（読み込みの途中で消すと、開けなくなる）
    const markerId = pending.current ?? selectedId;
    const requestAt = pendingRequest.current ?? (spotLat !== undefined && spotLng !== undefined ? { lat: spotLat, lng: spotLng } : null);
    const { pathname, search, hash } = window.location;
    const next = `${pathname}${encodeSharedView({ filter, markerId, requestAt }, search)}${hash}`;
    if (next !== `${pathname}${search}${hash}`) window.history.replaceState(window.history.state, '', next);
  }, [filter, selectedId, spotLat, spotLng]);
}
