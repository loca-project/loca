/**
 * YouTube Data API の結果から、マーカーの更新と論理削除の計画を立てる（T24・ADR 0017）。通信しない。
 *
 * - 公開中・限定公開の動画: 再生数・高評価数・投稿日・長さ（秒）で youtube 項目を更新する
 * - API が返さない動画（削除・存在しない）と非公開の動画: 消えたものとして論理削除の対象にする
 * - 10 件以上あって 2 割を超えて「消えた」と出たら、削除を止める（API の異常で消しすぎないため）
 */

/** 1 回の videos.list で問い合わせられる動画の数（API の上限）。 */
export const VIDEOS_PER_CALL = 50;

const GONE_RATIO_LIMIT = 0.2;
const GONE_RATIO_MIN_MARKERS = 10;

/** ISO 8601 の長さ（PT4M13S など）を秒にする。読めなければ null。 */
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '');
  if (!m || iso === 'P' || iso === 'PT') return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((v) => (v === undefined ? 0 : v));
  return Number(d) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

const isGone = (item) =>
  !item || item.status?.privacyStatus === 'private' || ['deleted', 'rejected', 'failed'].includes(item.status?.uploadStatus);

/** API の 1 件を youtube 項目にする。無い値は持たない（再生数を隠している動画など）。 */
function toStats(item) {
  const stats = {};
  const views = item.statistics?.viewCount;
  const likes = item.statistics?.likeCount;
  if (views !== undefined) stats.viewCount = Number(views);
  if (likes !== undefined) stats.likeCount = Number(likes);
  if (item.snippet?.publishedAt) stats.publishedAt = item.snippet.publishedAt;
  const seconds = parseDuration(item.contentDetails?.duration);
  if (seconds !== null) stats.durationSec = seconds;
  return stats;
}

/**
 * markers: 論理削除されていないマーカー（{ id, videoId }）。items: videos.list が返した動画。
 * 返り値: updates（{ id, youtube }）、gone（論理削除するマーカー ID）、blockedGone（止めた件数）
 */
export function planRefresh(markers, items) {
  const byVideo = new Map(items.map((i) => [i.id, i]));
  const updates = [];
  let gone = [];
  for (const m of markers) {
    const item = byVideo.get(m.videoId);
    if (isGone(item)) gone.push(m.id);
    else updates.push({ id: m.id, youtube: toStats(item) });
  }
  let blockedGone = 0;
  if (markers.length >= GONE_RATIO_MIN_MARKERS && gone.length / markers.length > GONE_RATIO_LIMIT) {
    blockedGone = gone.length;
    gone = [];
  }
  return { updates, gone, blockedGone };
}
