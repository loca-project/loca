/**
 * 投稿された内容を外部情報で補う。
 * ここはサーバー側（GitHub Actions）で動くので CORS の制約は無いが、
 * Google API は使わない方針なので oEmbed と OpenStreetMap の Nominatim だけを使う（ADR 0032）。
 */

import { PREFECTURES, prefectureFromCode } from './prefectures.mjs';

const OEMBED = 'https://www.youtube.com/oembed';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
/** 呼び出し元を名乗る（Nominatim の規約。ライブラリの既定の User-Agent を使わない）。 */
const USER_AGENT = 'Loca/0.2 (https://loca-project.github.io/; static map site)';
/**
 * Nominatim の問い合わせの間隔。定期的に動くスクリプトは 1 分に 4 回まで（規約）なので 15 秒あける。
 * 呼ぶ側（sync-firestore.mjs）は 1 回の同期で問い合わせる件数も絞る。
 */
export const NOMINATIM_INTERVAL_MS = 15_000;

/** YouTube oEmbed からタイトル・チャンネル・サムネイルを取る。 */
export async function fetchVideoMeta(videoId) {
  const url = `${OEMBED}?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`動画情報を取得できませんでした (oEmbed ${res.status})。URL または公開設定を確認してください。`);
  }
  const data = await res.json();
  if (!data.title) throw new Error('動画情報が空でした。URL を確認してください。');
  return {
    title: data.title,
    channelTitle: data.author_name ?? '',
    thumbnailUrl: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  };
}

/**
 * Nominatim の住所から都道府県と市区町村（Loca の粒度）を取り出す。src/adapters/geocode/nominatim.ts の placeFromAddress と同じ規則。
 * 東京都は province が空で返るので、ISO 3166-2 のコード（JP-13）から引く。
 */
export function placeFromAddress(address) {
  if (!address || address.country_code !== 'jp') return null;
  const iso = address['ISO3166-2-lvl4'] ?? '';
  const byCode = /^JP-\d{2}$/.test(iso) ? prefectureFromCode(iso.slice(3)) : '';
  const byName = [address.province, address.state].find((p) => p && PREFECTURES.includes(p)) ?? '';
  const prefecture = byCode || byName;
  if (!prefecture) return null;
  return { prefecture, city: address.city ?? address.town ?? address.village ?? '' };
}

let lastRequestAt = 0;
/** 同じプロセスで同じ地点を 2 回問い合わせない（規約のキャッシュ）。4 桁（約 10 m）で丸める */
const placeCache = new Map();

/**
 * Nominatim の逆ジオコーディングで都道府県・市町村を引く。失敗しても投稿は通す（空で返す）。
 * 海上など市町村に属さない地点では住所が返らないので、そのときも空になる。
 */
export async function fetchPlace(lat, lng) {
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (placeCache.has(key)) return placeCache.get(key);
  const empty = { prefecture: '', city: '' };
  try {
    const wait = lastRequestAt + NOMINATIM_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '10', 'accept-language': 'ja' });
    const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return empty;
    const place = placeFromAddress((await res.json())?.address) ?? empty;
    placeCache.set(key, place);
    return place;
  } catch (e) {
    console.warn('[loca] 地名を取得できませんでした:', e.message);
    return empty;
  }
}
