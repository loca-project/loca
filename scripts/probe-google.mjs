/**
 * Actions から Google の API に届くかを確かめる（T23・ADR 0017）。probe-google.yml が手動で呼ぶ。
 *
 * 1. YouTube Data API で公開動画 1 本の情報（再生数・投稿日・長さ・合成メディアの申告）を取れる
 * 2. Workload Identity 連携で得たトークンで、Firestore に書いて、読んで、消せる
 *    （probes コレクションはルールに無いので、利用者からは読めも書けもしない。IAM の経路だけが通る）
 *
 * 環境変数: YOUTUBE_API_KEY（Secrets）、GOOGLE_ACCESS_TOKEN（auth の出力）、GCP_PROJECT
 */

const { YOUTUBE_API_KEY, GOOGLE_ACCESS_TOKEN, GCP_PROJECT } = process.env;
if (!YOUTUBE_API_KEY || !GOOGLE_ACCESS_TOKEN || !GCP_PROJECT) {
  console.error('NG: YOUTUBE_API_KEY・GOOGLE_ACCESS_TOKEN・GCP_PROJECT のどれかがありません');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// 1. YouTube Data API（既定は YouTube 最初の動画。消えにくい公開動画として使う。手動実行の入力 video で変えられる）
const VIDEO = /^[\w-]{11}$/.test(process.env.PROBE_VIDEO ?? '') ? process.env.PROBE_VIDEO : 'jNQXAC9IVRw';
console.log(`動画 ${VIDEO}`);
const yt = await fetch(
  `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${VIDEO}&key=${YOUTUBE_API_KEY}`,
);
const video = yt.ok ? (await yt.json()).items?.[0] : null;
check('YouTube Data API で動画情報を取れる', Boolean(video?.statistics?.viewCount), `HTTP ${yt.status}`);
check('投稿日と長さが取れる', Boolean(video?.snippet?.publishedAt && video?.contentDetails?.duration),
  `${video?.snippet?.publishedAt ?? '-'} / ${video?.contentDetails?.duration ?? '-'}`);
// containsSyntheticMedia の有無を記録する。2026-09-25、申告済みの動画でも API キーでは返らなかった（T44 取り下げ。ADR 0014 の追記）
check('status.containsSyntheticMedia の有無を記録', true,
  video?.status && 'containsSyntheticMedia' in video.status ? `あり（${video.status.containsSyntheticMedia}）` : '返らない');
console.log(`status: ${JSON.stringify(video?.status ?? null)}`);

// 2. Firestore（IAM の経路）
const doc = `https://firestore.googleapis.com/v1/projects/${GCP_PROJECT}/databases/(default)/documents/probes/actions`;
const auth = { Authorization: `Bearer ${GOOGLE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
const stamp = new Date().toISOString();
const put = await fetch(doc, { method: 'PATCH', headers: auth, body: JSON.stringify({ fields: { ranAt: { timestampValue: stamp } } }) });
check('Firestore に書ける', put.ok, `HTTP ${put.status}`);
const got = await fetch(doc, { headers: auth });
const body = got.ok ? await got.json() : null;
check('書いた値を読める', body?.fields?.ranAt?.timestampValue?.startsWith(stamp.slice(0, 19)) ?? false, `HTTP ${got.status}`);
const del = await fetch(doc, { method: 'DELETE', headers: auth });
check('後片付けで消せる', del.ok, `HTTP ${del.status}`);

results.forEach((r) => console.log(`${r.ok ? 'OK ' : 'NG '} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`));
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed} / ${results.length} 件 OK`);
process.exit(passed === results.length ? 0 : 1);
