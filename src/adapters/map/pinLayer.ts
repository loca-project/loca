/**
 * ピンの描画と、密集地のクラスタ（T41）。
 *
 * どのピンをまとめるかは GeoJSON ソースの cluster に計算させ、画面に出すのは今見えている分だけにする
 * （ピンを 1 本ずつ DOM の Marker で置くと、件数が数千になると地図の操作が重くなる）。
 * 見た目は DOM の要素のまま（地図のスタイルに文字のグリフが無く、シンボルのレイヤーでは件数を描けないため）。
 */

import type { GeoJSONSource, Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import type { MapPinOptions } from '@/ports';
import { createClusterElement, createPinElement } from './pinElement';

type MapLibreModule = typeof import('maplibre-gl');

export const PIN_SOURCE = 'loca-pins';
/** ソースのタイルを読ませるための見えないレイヤー（レイヤーが無いソースは読み込まれない） */
const PIN_PROBE_LAYER = 'loca-pins-probe';
/** まとめる距離（px）。ピンの幅と同じくらいにし、重ならないピンはまとめない */
const CLUSTER_RADIUS = 32;
/** これより寄ったら、近くてもまとめない（同じ建物の複数の動画を押し分けられるように） */
const CLUSTER_MAX_ZOOM = 15;

interface Shown {
  marker: MlMarker;
  /** 見た目が変わったら作り直すための印 */
  signature: string;
}

const signatureOf = (p: MapPinOptions): string => `${p.color}|${p.label ?? ''}|${p.ghost ? 1 : 0}`;

export class PinLayer {
  private pins = new Map<string, MapPinOptions>();
  private shown = new Map<string, Shown>();
  private refreshQueued = false;

  constructor(
    private readonly map: MlMap,
    private readonly lib: MapLibreModule,
  ) {
    map.addSource(PIN_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: CLUSTER_RADIUS,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
    });
    map.addLayer({
      id: PIN_PROBE_LAYER,
      type: 'circle',
      source: PIN_SOURCE,
      paint: { 'circle-radius': 0, 'circle-opacity': 0, 'circle-stroke-width': 0 },
    });
    map.on('moveend', () => this.queueRefresh());
    map.on('sourcedata', (e) => {
      if (e.sourceId === PIN_SOURCE && e.isSourceLoaded) this.queueRefresh();
    });
  }

  /** ピンの全置き換え。まとめ直しはソースの読み込みが終わったとき（sourcedata）に行う。 */
  setPins(pins: MapPinOptions[]): void {
    this.pins = new Map(pins.map((p) => [p.id, p]));
    const source = this.map.getSource(PIN_SOURCE) as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: pins.map((p) => ({
        type: 'Feature',
        properties: { id: p.id },
        geometry: { type: 'Point', coordinates: [p.position.lng, p.position.lat] },
      })),
    });
    this.queueRefresh();
  }

  destroy(): void {
    this.shown.forEach((s) => s.marker.remove());
    this.shown.clear();
    this.pins.clear();
  }

  /** 1 フレームにまとめて描き直す（sourcedata と moveend が続けて来るため） */
  private queueRefresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => {
      this.refreshQueued = false;
      this.refresh();
    });
  }

  /** 今読み込まれているタイルの点とクラスタを DOM に映す。消えたものは外し、増えたものだけ足す。 */
  private refresh(): void {
    if (!this.map.getSource(PIN_SOURCE)) return;
    const next = new Map<string, { lngLat: [number, number]; make: () => HTMLElement; signature: string }>();
    for (const f of this.map.querySourceFeatures(PIN_SOURCE)) {
      if (f.geometry.type !== 'Point') continue;
      const lngLat = f.geometry.coordinates as [number, number];
      const props = f.properties ?? {};
      if (props.cluster) {
        const clusterId = Number(props.cluster_id);
        const count = Number(props.point_count);
        next.set(`cluster:${clusterId}`, {
          lngLat,
          signature: String(count),
          make: () => this.clusterElement(clusterId, count, lngLat),
        });
        continue;
      }
      const pin = this.pins.get(String(props.id));
      if (!pin) continue;
      next.set(pin.id, {
        lngLat: [pin.position.lng, pin.position.lat],
        signature: signatureOf(pin),
        make: () => this.pinElement(pin.id, pin),
      });
    }

    for (const [key, s] of this.shown) {
      const want = next.get(key);
      if (!want || want.signature !== s.signature) {
        s.marker.remove();
        this.shown.delete(key);
      }
    }
    for (const [key, want] of next) {
      const existing = this.shown.get(key);
      if (existing) {
        existing.marker.setLngLat(want.lngLat);
        continue;
      }
      const marker = new this.lib.Marker({
        element: want.make(),
        anchor: key.startsWith('cluster:') ? 'center' : 'bottom',
      })
        .setLngLat(want.lngLat)
        .addTo(this.map);
      this.shown.set(key, { marker, signature: want.signature });
    }
  }

  private pinElement(id: string, pin: MapPinOptions): HTMLElement {
    const el = createPinElement({ color: pin.color, label: pin.label, ghost: pin.ghost });
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // 押した時点の最新の設定で動かす（setPins のたびに作り直さないため）
      this.pins.get(id)?.onClick?.();
    });
    return el;
  }

  /** クラスタを押したら、まとまりがほどける倍率まで寄る */
  private clusterElement(clusterId: number, count: number, lngLat: [number, number]): HTMLElement {
    const el = createClusterElement(count);
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const source = this.map.getSource(PIN_SOURCE) as GeoJSONSource | undefined;
      if (!source) return;
      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => this.map.easeTo({ center: lngLat, zoom: Math.min(zoom, CLUSTER_MAX_ZOOM + 1), duration: 500 }))
        .catch((e: unknown) => console.error('[loca] クラスタを広げられませんでした', e));
    });
    return el;
  }
}
