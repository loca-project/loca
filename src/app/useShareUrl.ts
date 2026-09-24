/**
 * 地図フィルタと選択中のマーカーを URL に映し、開いたときに戻す（T42）。
 * URL の形は core/logic/shareUrl.ts。履歴は増やさず（replaceState）、今の URL を書き換えるだけにする。
 */

import { useEffect, useRef } from 'react';
import type { MapFilter } from '@/core/types';
import { decodeSharedView, encodeSharedView, type SharedView } from '@/core/logic/shareUrl';
import type { LocaApp } from './useLocaApp';

/** 開いたときの URL に載っていた状態。描画の前に 1 回だけ読む */
export function readSharedView(): SharedView {
  return decodeSharedView(window.location.search);
}

export function useShareUrl(app: LocaApp, filter: MapFilter, initialMarkerId: string | null): void {
  /** URL に載っていて、まだ開いていないマーカーの ID。公開データが届いたら開く */
  const pending = useRef(initialMarkerId);
  const { catalog, handleMarkerClick, jumpTo } = app;

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

  const selectedId = app.selectedMarker?.id ?? null;
  useEffect(() => {
    // 開く前のマーカーは URL に残しておく（読み込みの途中で消すと、開けなくなる）
    const markerId = pending.current ?? selectedId;
    const { pathname, search, hash } = window.location;
    const next = `${pathname}${encodeSharedView({ filter, markerId }, search)}${hash}`;
    if (next !== `${pathname}${search}${hash}`) window.history.replaceState(window.history.state, '', next);
  }, [filter, selectedId]);
}
