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

/** テストに出てくる利用者。投稿にはプロフィールの登録が要るので、既定で全員登録済みにしておく。 */
export const REGISTERED = ['alice', 'bob', 'carol', 'mallory', 'root'];

/** 登録済みのプロフィール（seed 用）。ニックネームは newMarker の createdBy と同じ。 */
export function storedProfile(uid) {
  const past = Timestamp.fromMillis(Date.parse('2026-01-01T00:00:00Z'));
  return { nickname: `${uid} さん`, consentVersion: 1, agreedAt: past, createdAt: past, updatedAt: past };
}

/** Firestore を空にし、REGISTERED の全員のプロフィールと名前の索引（nicknames/{小文字}）を置く。 */
export async function resetFirestore(env, registered = REGISTERED) {
  await env.clearFirestore();
  await seed(env, async (db) => {
    for (const uid of registered) {
      const profile = storedProfile(uid);
      await setDoc(doc(db, 'users', uid), profile);
      await setDoc(doc(db, 'nicknames', profile.nickname.toLowerCase()), { uid });
    }
  });
}

/** アプリと同じ手順で登録する: プロフィールと名前の索引を同じバッチで書く。 */
export function registerWrite(db, uid, profile) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), profile);
  batch.set(doc(db, 'nicknames', profile.nickname.toLowerCase()), { uid });
  return batch.commit();
}

let videoSeq = 0;

/** 呼ぶたびに別の 11 文字の動画 ID（重複の禁止に引っかからないように）。 */
export function nextVideoId() {
  videoSeq += 1;
  return `vid${String(videoSeq).padStart(8, '0')}`;
}

export const urlOf = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

/** 正しい形の新規マーカー。上書きしたい項目だけ渡す。動画は毎回別のものになる。 */
export function newMarker(uid, overrides = {}) {
  const videoId = overrides.videoId ?? nextVideoId();
  return {
    youtubeUrl: urlOf(videoId),
    videoId,
    lat: 35.681,
    lng: 139.767,
    tags: { subject: 'nature', mood: 'calm' },
    equipment: { category: '', manufacturer: '', series: '', model: '' },
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
export function stampedWrite(db, uid, markerId, data, mode = 'set', { index = mode === 'set' } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'rateLimits', uid), { lastWriteAt: serverTimestamp(), target: markerId });
  const ref = doc(db, 'markers', markerId);
  if (mode === 'set') batch.set(ref, data);
  else batch.update(ref, data);
  // 作成（と動画の差し替え）では、動画の索引も同じバッチで作る
  if (index && data.videoId) batch.set(doc(db, 'videos', data.videoId), { markerId, ownerUid: uid });
  return batch.commit();
}

/** 印の時刻を過去にずらし、レートリミットの間隔を空けたことにする。 */
export async function expireStamp(env, uid) {
  await seed(env, (db) => setDoc(doc(db, 'rateLimits', uid), {
    lastWriteAt: Timestamp.fromMillis(Date.now() - 60_000),
    target: 'old',
  }));
}
