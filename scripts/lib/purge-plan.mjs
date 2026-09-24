/**
 * 論理削除から日数がたった行の物理削除の計画（ADR 0021・T58）。通信しない。
 *
 * 消すのは、次の両方より前に論理削除・取り下げされた行だけ。
 * - 今から retentionDays 日前（誤操作と通報の調査のための猶予）
 * - 公開データの syncedAt（同期が止まって公開データが古いときも、差分の購読で届けるべき削除を消さないため。ADR 0013）
 */

export const RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * markers: { id, deleted, updatedAt, videoId }、requests: { id, withdrawn, updatedAt }、videos: { id, markerId, blocked }
 * 時刻は epoch ms。返り値: cutoff と、消すマーカー・リクエスト・動画の索引の ID。
 */
export function planPurge({ markers, requests, videos, now, syncedAt, retentionDays = RETENTION_DAYS }) {
  if (!Number.isFinite(syncedAt) || syncedAt <= 0) throw new Error('公開データの syncedAt が読めません');
  const cutoff = Math.min(now - retentionDays * DAY_MS, syncedAt);
  const old = (row) => Number.isFinite(row.updatedAt) && row.updatedAt < cutoff;

  const markerIds = markers.filter((m) => m.deleted === true && old(m)).map((m) => m.id);
  const requestIds = requests.filter((r) => r.withdrawn === true && old(r)).map((r) => r.id);

  // 消すマーカーを指す索引と、指す先のマーカーがもう無い索引を外す。禁止の印が付いた索引は残す（同じ動画を登録させない）
  const purged = new Set(markerIds);
  const existing = new Set(markers.map((m) => m.id));
  const videoIds = videos
    .filter((v) => v.blocked !== true && (purged.has(v.markerId) || !existing.has(v.markerId)))
    .map((v) => v.id);

  return { cutoff, markerIds, requestIds, videoIds };
}
