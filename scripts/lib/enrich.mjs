/**
 * 投稿された内容を外部情報で補う。
 * ここはサーバー側（GitHub Actions）で動くので CORS の制約は無いが、
 * Google API は使わない方針なので oEmbed と国土地理院だけを使う（ADR 0011）。
 */

import { prefectureFromCode } from './prefectures.mjs';

const OEMBED = 'https://www.youtube.com/oembed';
const GSI_REVERSE = 'https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress';
const GSI_MUNI = 'https://maps.gsi.go.jp/js/muni.js';
/** 呼び出し元を名乗る。 */
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
 * 市町村コード表（muni.js）を読む。行の形式と区の扱いは src/adapters/geocode/gsi.ts と同じ。
 * 1 回の取り込みで複数件を処理するので、プロセス内で 1 回だけ取得する。
 */
let muniTable = null;
async function loadMuniTable() {
  if (muniTable) return muniTable;
  const res = await fetch(GSI_MUNI, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`市町村コード表を取得できませんでした (${res.status})`);
  const table = new Map();
  const line = /MUNI_ARRAY\["(\d+)"\]\s*=\s*'\d+,([^,]+),\d+,([^']+)'/g;
  for (const m of (await res.text()).matchAll(line)) {
    table.set(String(Number(m[1])), { prefecture: m[2], city: m[3].split('　')[0].trim() });
  }
  muniTable = table;
  return table;
}

/**
 * 国土地理院の逆ジオコーダで都道府県・市町村を引く。失敗しても投稿は通す（空で返す）。
 * 海上など市町村に属さない地点では結果が返らないので、そのときも空になる。
 */
export async function fetchPlace(lat, lng) {
  try {
    const res = await fetch(`${GSI_REVERSE}?lat=${lat}&lon=${lng}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return { prefecture: '', city: '' };
    const code = String((await res.json())?.results?.muniCd ?? '');
    if (!/^\d+$/.test(code)) return { prefecture: '', city: '' };
    const hit = (await loadMuniTable()).get(String(Number(code)));
    return {
      prefecture: hit?.prefecture ?? prefectureFromCode(code.padStart(5, '0').slice(0, 2)),
      city: hit?.city ?? '',
    };
  } catch (e) {
    console.warn('[loca] 地名を取得できませんでした:', e.message);
    return { prefecture: '', city: '' };
  }
}
