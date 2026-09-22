/**
 * OpenStreetMap Nominatim によるジオコーディング。
 * API キーは不要だが、利用規約で 1 秒 1 リクエストの上限がある。
 * ここでは呼び出し間隔を強制し、失敗時はオフライン実装に委ねる想定。
 */

import type { LatLng, PlaceMeta } from '@/core/types';
import type { GeocodePort } from '@/ports';
import { UpstreamError } from '@/ports';
import { prefectureFromIsoCode } from '@/core/constants';
import { nearestPrefecture } from './prefectureCentroids';

const BASE = 'https://nominatim.openstreetmap.org';
/** 利用規約に合わせた最小間隔（ミリ秒）。 */
const MIN_INTERVAL_MS = 1100;

let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any> {
  await throttle();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new UpstreamError(`Nominatim エラー (${res.status})`);
  return res.json();
}

export const nominatimGeocodeAdapter: GeocodePort = {
  name: 'nominatim',
  providesCity: true,

  async probe(): Promise<boolean> {
    return typeof fetch === 'function';
  },

  async reverse(lat: number, lng: number): Promise<PlaceMeta> {
    const url = `${BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ja&zoom=10`;
    let data: any;
    try {
      data = await getJson(url);
    } catch (e) {
      throw new UpstreamError('地図情報（都道府県・市町村）の取得に失敗しました。', e);
    }
    const addr = data?.address ?? {};
    // 東京 23 区などは province を返さないため、ISO コード → 最近傍 の順に落とす
    const prefecture: string =
      addr.province ||
      addr.state ||
      prefectureFromIsoCode(addr['ISO3166-2-lvl4']) ||
      nearestPrefecture(lat, lng);
    const city: string = addr.city ?? addr.town ?? addr.village ?? addr.county ?? '';
    if (!prefecture) throw new UpstreamError('地図情報（都道府県・市町村）の取得に失敗しました。');
    return { prefecture, city, source: 'nominatim' };
  },

  async forward(address: string): Promise<LatLng> {
    const url = `${BASE}/search?format=jsonv2&q=${encodeURIComponent(address)}&limit=1&accept-language=ja`;
    let data: any;
    try {
      data = await getJson(url);
    } catch (e) {
      throw new UpstreamError('場所が見つかりませんでした。', e);
    }
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) throw new UpstreamError('場所が見つかりませんでした。');
    return { lat: Number(hit.lat), lng: Number(hit.lon) };
  },
};
