/**
 * ルールのテスト用の共通処理。
 *
 * エミュレータの中で動く前提（npm run test:rules が firebase emulators:exec で起動する）。
 * プロジェクト ID は demo- で始まるので、本番の loca-d3792 には一切つながらない。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const PROJECT_ID = 'demo-loca';

export async function setupEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile(path.join(ROOT, 'firestore.rules'), 'utf8') },
  });
}

/** ルールを通さずにデータを置く（前提の準備用）。 */
export async function seed(env, fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

/** 正しい形の新規マーカー。上書きしたい項目だけ渡す。 */
export function newMarker(uid, overrides = {}) {
  return {
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    lat: 35.681,
    lng: 139.767,
    tags: { action: '行きたい', atmosphere: '静か', emotion: '癒し' },
    equipment: { manufacturer: '', series: '', model: '' },
    title: 'テスト動画',
    ownerUid: uid,
    createdBy: `${uid} さん`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deleted: false,
    ...overrides,
  };
}

/** seed で置く既存マーカー（時刻は固定値）。 */
export function storedMarker(uid, overrides = {}) {
  const past = Timestamp.fromMillis(Date.parse('2026-01-01T00:00:00Z'));
  return newMarker(uid, { createdAt: past, updatedAt: past, ...overrides });
}

/**
 * アプリと同じ手順でマーカーを書く: 同じバッチで rateLimits/{uid} に印を付ける。
 * mode は 'set'（作成）か 'update'。
 */
export function stampedWrite(db, uid, markerId, data, mode = 'set') {
  const batch = writeBatch(db);
  batch.set(doc(db, 'rateLimits', uid), { lastWriteAt: serverTimestamp(), target: markerId });
  const ref = doc(db, 'markers', markerId);
  if (mode === 'set') batch.set(ref, data);
  else batch.update(ref, data);
  return batch.commit();
}

/** 印の時刻を過去にずらし、レートリミットの間隔を空けたことにする。 */
export async function expireStamp(env, uid) {
  await seed(env, (db) => setDoc(doc(db, 'rateLimits', uid), {
    lastWriteAt: Timestamp.fromMillis(Date.now() - 60_000),
    target: 'old',
  }));
}
