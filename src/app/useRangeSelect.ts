/**
 * 範囲指定モード（要件 3.1.3）の始め方と抜け方。
 * 描いた範囲の外をクリックするか Esc を押したら、範囲と結果パネルを閉じて抜ける。内側のクリックでは保つ。
 */

import { useCallback, useEffect } from 'react';
import type { Bounds, LatLng, MarkerData } from '@/core/types';
import { isInsideBounds } from '@/core/logic/geo';
import type { LocaApp } from './useLocaApp';
import type { useSearchAndRanking } from './useSearchAndRanking';

type Search = ReturnType<typeof useSearchAndRanking>;

export function useRangeSelect(app: LocaApp, search: Search, markers: MarkerData[], onDrawn: () => void) {
  const { drawing, rectangle, setDrawing, setRectangle, handleMapClick } = app;
  const { close, searchInBounds } = search;

  /** 範囲指定を解く（矩形・描画中の状態・その結果パネル）。 */
  const clear = useCallback(() => {
    setDrawing(false);
    setRectangle(null);
    close();
  }, [setDrawing, setRectangle, close]);

  const active = drawing || rectangle !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, clear]);

  const onMapClick = useCallback(
    (pos: LatLng) => {
      if (rectangle && !drawing && !isInsideBounds(pos, rectangle)) clear();
      handleMapClick(pos);
    },
    [rectangle, drawing, clear, handleMapClick],
  );

  const onRectangleDrawn = useCallback(
    (bounds: Bounds) => {
      setDrawing(false);
      setRectangle(bounds);
      searchInBounds(bounds, markers);
      onDrawn();
    },
    [setDrawing, setRectangle, searchInBounds, markers, onDrawn],
  );

  return { clear, onMapClick, onRectangleDrawn };
}
