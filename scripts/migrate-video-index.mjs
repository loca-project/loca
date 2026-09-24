/**
 * 既存のマーカーに videoId と動画の索引 videos/{videoId} を入れる（重複の禁止を入れる前に登録された行のため）。
 *
 *   npm run migrate:video-index           足りないものだけを書く（何度実行しても同じ結果になる）
 *   npm run migrate:video-index -- --check 書かずに件数だけ出す
 *
 * オーナーの権限（lib/owner-auth.mjs）で書く。マーカーの updatedAt は変えない（中身は同じなので）。
 * 論理削除済みの行には索引を作らない（同じ動画を登録し直せるように）。
 * 同じ動画の表示中のマーカーが 2 件以上あれば、索引は最も古い 1 件に付け、残りを一覧で知らせる（自動では消さない）。
 */

import { FIRESTORE, call, ownerToken } from './lib/owner-auth.mjs';
import { listCollection } from './lib/firestore-rest.mjs';
import { firestoreConfig } from './lib/env.mjs';

const CHECK_ONLY = process.argv.includes('--check');
const VIDEO_ID = /(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/;

const { token } = await ownerToken();
const markers = await listCollection(await firestoreConfig(), 'markers');

let patched = 0;
let indexed = 0;
const duplicates = [];
const byVideo = new Map();

for (const m of [...markers].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))) {
  const videoId = m.videoId ?? VIDEO_ID.exec(m.youtubeUrl ?? '')?.[1];
  if (!videoId) {
    console.log(`NG  動画 ID を読めない: ${m.id} ${m.youtubeUrl}`);
    continue;
  }
  const canonical = `https://www.youtube.com/watch?v=${videoId}`;
  if (m.videoId !== videoId || m.youtubeUrl !== canonical) {
    patched += 1;
    if (!CHECK_ONLY) {
      const mask = 'updateMask.fieldPaths=videoId&updateMask.fieldPaths=youtubeUrl';
      await call(token, 'PATCH', `${FIRESTORE}/markers/${m.id}?${mask}`, {
        fields: { videoId: { stringValue: videoId }, youtubeUrl: { stringValue: canonical } },
      });
    }
  }
  if (m.deleted === true) continue;
  if (byVideo.has(videoId)) {
    duplicates.push(`${videoId}: ${byVideo.get(videoId)} と ${m.id}`);
    continue;
  }
  byVideo.set(videoId, m.id);
  const existing = await call(token, 'GET', `${FIRESTORE}/videos/${videoId}`);
  if (!existing) {
    indexed += 1;
    if (!CHECK_ONLY) {
      await call(token, 'PATCH', `${FIRESTORE}/videos/${videoId}`, {
        fields: { markerId: { stringValue: m.id }, ownerUid: { stringValue: m.ownerUid ?? '' } },
      });
    }
  }
}

const verb = CHECK_ONLY ? '必要' : '実施';
console.log(`マーカー ${markers.length} 件: videoId の補完 ${patched} 件・索引の作成 ${indexed} 件（${verb}）`);
if (duplicates.length > 0) {
  console.log(`同じ動画の表示中のマーカー ${duplicates.length} 組（管理者が判断する）:`);
  for (const d of duplicates) console.log(`  ${d}`);
}
