/**
 * 投稿された内容を外部情報で補う。
 * ここはサーバー側（GitHub Actions）で動くので CORS の制約は無いが、
 * Google API は使わない方針なので oEmbed と Nominatim だけを使う。
 */

import { prefectureFromIsoCode } from './prefectures.mjs';

const OEMBED = 'https://www.youtube.com/oembed';
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
/** Nominatim の利用規約に従い、自分を名乗る。 */
const USER_AGENT = 'Loca/0.2 (https://github.com/; static map site)';

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
 * Nominatim で都道府県・市町村を引く。失敗しても投稿は通す（空で返す）。
 *
 * 東京 23 区や政令指定都市では `province` が返らないことが実測で分かっている。
 * その場合でも `ISO3166-2-lvl4`（JP-13 など）は必ず返るので、そこから引き当てる。
 */
export async function fetchPlace(lat, lng) {
  try {
    const url = `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ja&zoom=10`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return { prefecture: '', city: '' };
    const data = await res.json();
    const addr = data?.address ?? {};
    return {
      prefecture:
        addr.province || addr.state || prefectureFromIsoCode(addr['ISO3166-2-lvl4']) || '',
      city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? '',
    };
  } catch (e) {
    console.warn('[loca] 地名を取得できませんでした:', e.message);
    return { prefecture: '', city: '' };
  }
}

/** Nominatim の 1 req/s 制限を守るための待機。 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
