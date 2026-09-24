/**
 * Firestore の requests と、今の requests.json を合わせて、次の requests.json の地点一覧を作る（通信しない）。
 *
 * まとめ方は src/core/logic/requests.ts の mergeRequestEntries と同じ（近い地点に足す・無ければ作る）。
 * SAME_SPOT_EPS は両方で揃える（npm run verify が一致を検査する）。
 *
 * - GitHub Issue 経由のリクエスト（ID が re_ で始まる）は残す。
 * - Firestore 由来のリクエストは毎回すべて入れ直す（管理者が消した行を落とすため）。
 * - リクエストが 1 件も無くなった地点は消す。
 * - 作り直した地点は、前回の同じ ID の地点から地名を引き継ぐ（毎日の問い合わせを減らすため）。
 */

export const SAME_SPOT_EPS = 0.0003;

const isNear = (a, b) => Math.abs(a.lat - b.lat) < SAME_SPOT_EPS && Math.abs(a.lng - b.lng) < SAME_SPOT_EPS;
const fromIssue = (entry) => String(entry.id).startsWith('re_');

export function mergeRequests(firestoreRows, currentSpots) {
  const previous = new Map(currentSpots.map((s) => [s.id, s]));
  // Issue 経由の分だけを残した地点から始める
  const spots = currentSpots
    .map((s) => ({ ...s, entries: (s.entries ?? []).filter(fromIssue) }))
    .filter((s) => s.entries.length > 0);

  const sorted = [...firestoreRows].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  for (const row of sorted) {
    let spot = spots.find((s) => isNear(s, row));
    if (!spot) {
      const id = `rq_${row.id}`;
      const prev = previous.get(id);
      const place = prev?.prefecture ? { prefecture: prev.prefecture, city: prev.city ?? '' } : {};
      spot = { id, lat: row.lat, lng: row.lng, ...place, entries: [] };
      spots.push(spot);
    }
    spot.entries.push({
      id: row.id,
      heat: row.heat,
      season: row.season ?? '',
      timeOfDay: row.timeOfDay ?? '',
      atmosphere: row.atmosphere ?? '',
      equipment: row.equipment,
      // 本人の取り下げに使う（uid は markers でも公開している識別子）
      ownerUid: row.ownerUid,
      createdAt: row.createdAt ?? 0,
    });
  }

  for (const s of spots) {
    s.totalHeat = s.entries.reduce((sum, e) => sum + e.heat, 0);
    s.requestCount = s.entries.length;
    s.updatedAt = Math.max(0, ...s.entries.map((e) => e.createdAt ?? 0));
  }
  return spots.sort((a, b) => b.totalHeat - a.totalHeat);
}
