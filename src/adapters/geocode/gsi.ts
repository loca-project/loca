/**
 * 国土地理院によるジオコーディング（ADR 0011）。
 *
 * - 座標 → 地名: 逆ジオコーダが市町村コードを返し、市町村コード表（muni.js）で名前に引く
 * - 地名 → 座標: 住所検索 API
 *
 * いずれも API キー不要・CORS 対応。ただし地理院地図のための非公式 API であり、
 * 予告なく仕様が変わりうる。予備の実装は持たない方針なので、失敗はそのまま利用者に伝える。
 */

import type { LatLng, PlaceMeta } from '@/core/types';
import type { GeocodePort } from '@/ports';
import { UpstreamError } from '@/ports';
import { PREFECTURES, prefectureFromCode } from '@/core/constants';

const REVERSE_URL = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress';
const SEARCH_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch';
const MUNI_URL = 'https://maps.gsi.go.jp/js/muni.js';

interface Municipality {
  prefecture: string;
  city: string;
}

/** 市町村コード（先頭の 0 を除いた数値文字列）→ 名前。初回の逆ジオコーディング時に 1 回だけ読む。 */
let muniTable: Promise<Map<string, Municipality>> | null = null;

/**
 * muni.js の行 `GSI.MUNI_ARRAY["1101"] = '1,北海道,1101,札幌市　中央区';` を読む。
 * 政令指定都市の区は全角空白で区切られているので、市の名前だけを残す（従来の粒度に合わせる）。
 */
export function parseMuniTable(source: string): Map<string, Municipality> {
  const table = new Map<string, Municipality>();
  const line = /MUNI_ARRAY\["(\d+)"\]\s*=\s*'\d+,([^,]+),\d+,([^']+)'/g;
  for (const m of source.matchAll(line)) {
    table.set(String(Number(m[1])), { prefecture: m[2], city: m[3].split('　')[0].trim() });
  }
  return table;
}

function loadMuniTable(): Promise<Map<string, Municipality>> {
  muniTable ??= fetch(MUNI_URL)
    .then((res) => {
      if (!res.ok) throw new UpstreamError(`市町村コード表を取得できませんでした (${res.status})`);
      return res.text();
    })
    .then(parseMuniTable)
    .catch((e) => {
      // 失敗を覚えたままにしない。次の呼び出しで取り直す
      muniTable = null;
      throw e;
    });
  return muniTable;
}

interface SearchHit {
  geometry?: { coordinates?: number[] };
  properties?: { title?: string };
}

/**
 * 住所検索の候補から 1 件を選ぶ。API は関連度順に並べないため、先頭を採ると外れやすい
 * （実測:「東京タワー」の先頭は「北海道札幌市東区」、「渋谷駅」の先頭は「福島県猪苗代町渋谷」）。
 *
 * - 行政区画名（「港区」「札幌市」）は、都道府県から始まる正式表記（「東京都港区」）を優先する。
 *   完全一致の「港区」は熊本県の字名だった
 * - それ以外（「嵐山」「京都駅」）は完全一致を優先する。「埼玉県嵐山」のような別の地名を避けるため
 *
 * 同名が複数ある地名（「清水寺」は 16 件）は、どれが選ばれるかを保証できない。
 */
export function pickSearchHit(hits: SearchHit[], query: string): SearchHit | undefined {
  const title = (h: SearchHit) => h.properties?.title ?? '';
  const exact = () => hits.find((h) => title(h) === query);
  const official = () =>
    hits.find((h) => title(h) !== query && title(h).endsWith(query) && PREFECTURES.some((p) => title(h).startsWith(p)));
  const preferred = /[都道府県市区町村]$/.test(query) ? official() ?? exact() : exact() ?? official();
  return preferred ?? hits.find((h) => title(h).includes(query)) ?? hits[0];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new UpstreamError(`国土地理院 API エラー (${res.status})`);
  return res.json();
}

export const gsiGeocodeAdapter: GeocodePort = {
  name: 'gsi',

  async probe(): Promise<boolean> {
    return typeof fetch === 'function';
  },

  async reverse(lat: number, lng: number): Promise<PlaceMeta> {
    const failure = '地図情報（都道府県・市町村）の取得に失敗しました。';
    let code: string;
    let table: Map<string, Municipality>;
    try {
      const [data, loaded] = await Promise.all([
        getJson(`${REVERSE_URL}?lat=${lat}&lon=${lng}`),
        loadMuniTable(),
      ]);
      code = String(data?.results?.muniCd ?? '');
      table = loaded;
    } catch (e) {
      throw new UpstreamError(failure, e);
    }
    // 海上など日本の市町村に属さない地点では results が返らない
    if (!/^\d+$/.test(code)) throw new UpstreamError(failure);

    const hit = table.get(String(Number(code)));
    const prefecture = hit?.prefecture ?? prefectureFromCode(code.padStart(5, '0').slice(0, 2));
    if (!prefecture) throw new UpstreamError(failure);
    return { prefecture, city: hit?.city ?? '', source: 'gsi' };
  },

  async forward(address: string): Promise<LatLng> {
    const query = address.trim();
    let data: any;
    try {
      data = await getJson(`${SEARCH_URL}?q=${encodeURIComponent(query)}`);
    } catch (e) {
      throw new UpstreamError('場所が見つかりませんでした。', e);
    }
    const coords = Array.isArray(data) ? pickSearchHit(data, query)?.geometry?.coordinates : null;
    if (!Array.isArray(coords) || coords.length < 2) throw new UpstreamError('場所が見つかりませんでした。');
    // GeoJSON の並びは [経度, 緯度]
    return { lat: Number(coords[1]), lng: Number(coords[0]) };
  },
};
