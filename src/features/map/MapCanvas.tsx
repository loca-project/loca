/**
 * 地図の器。
 * MapPort を DOM に載せ、ピンの同期とクリックの受け渡しだけを行う。
 * どの地図エンジンかはここでは判断しない。
 */

import React, { useEffect, useRef, useState } from 'react';
import type { Bounds, LatLng } from '@/core/types';
import type { MapPinOptions } from '@/ports';
import { useServices } from '@/shared/hooks/useServices';

interface MapCanvasProps {
  pins: MapPinOptions[];
  ghost: LatLng | null;
  rectangle: Bounds | null;
  drawing: boolean;
  onMapClick: (pos: LatLng) => void;
  onRectangleDrawn: (bounds: Bounds) => void;
  onReady?: () => void;
}

export default function MapCanvas({
  pins,
  ghost,
  rectangle,
  drawing,
  onMapClick,
  onRectangleDrawn,
  onReady,
}: MapCanvasProps) {
  const { map } = useServices();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // 最新のハンドラを ref 経由で呼ぶ。地図側のリスナーを張り直さずに済む。
  const clickRef = useRef(onMapClick);
  const rectRef = useRef(onRectangleDrawn);
  clickRef.current = onMapClick;
  rectRef.current = onRectangleDrawn;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    const unsubs: (() => void)[] = [];

    void map
      .mount(container)
      .then(() => {
        if (disposed) return;
        unsubs.push(map.onMapClick((pos) => clickRef.current(pos)));
        unsubs.push(map.onRectangleDrawn((b) => rectRef.current(b)));
        setReady(true);
        onReady?.();
      })
      .catch((e: unknown) => {
        console.error('[loca] 地図を初期化できませんでした', e);
      });

    return () => {
      disposed = true;
      unsubs.forEach((u) => u());
      map.destroy();
    };
    // map は起動時に確定するので依存は固定でよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (ready) map.setPins(pins);
  }, [map, pins, ready]);

  useEffect(() => {
    if (ready) map.setGhostPin(ghost);
  }, [map, ghost, ready]);

  useEffect(() => {
    if (ready) map.showRectangle(rectangle);
  }, [map, rectangle, ready]);

  useEffect(() => {
    if (ready) map.setRectangleDrawing(drawing);
  }, [map, drawing, ready]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="地図" />;
}
