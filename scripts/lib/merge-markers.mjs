/**
 * Firestore の行と、今の markers.json を合わせて、次の markers.json の markers を作る（通信しない純粋な処理）。
 *
 * - 論理削除（deleted: true）の行は含めない（要件 1.4）。
 * - GitHub Issue 経由の行（ownerUid が無い）は残す。同じ ID が Firestore にあれば Firestore を正とする。
 * - 地名が空の行は、前回の markers.json で同じ座標に地名があれば引き継ぐ。
 * - 並びは登録の新しい順。
 */

/** 公開する項目だけに絞る（Firestore の行に余計な項目が混ざっても出さない）。 */
const PUBLIC_KEYS = [
  'id', 'youtubeUrl', 'videoId', 'lat', 'lng', 'tags', 'equipment', 'title', 'channelTitle', 'thumbnailUrl',
  'prefecture', 'city', 'ownerUid', 'createdBy', 'createdAt', 'updatedAt',
];

const pick = (row) => Object.fromEntries(PUBLIC_KEYS.filter((k) => row[k] !== undefined).map((k) => [k, row[k]]));

export function mergeMarkers(firestoreRows, currentMarkers) {
  const firestoreIds = new Set(firestoreRows.map((r) => r.id));
  const previous = new Map(currentMarkers.map((m) => [m.id, m]));

  const live = firestoreRows.filter((r) => r.deleted !== true).map((row) => {
    const m = pick(row);
    const prev = previous.get(m.id);
    if (!m.prefecture && prev?.prefecture && prev.lat === m.lat && prev.lng === m.lng) {
      Object.assign(m, { prefecture: prev.prefecture, city: prev.city ?? '' });
    }
    return m;
  });
  const fromIssues = currentMarkers.filter((m) => !m.ownerUid && !firestoreIds.has(m.id));

  return {
    markers: [...live, ...fromIssues].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    live: live.length,
    deleted: firestoreRows.length - live.length,
    fromIssues: fromIssues.length,
  };
}
