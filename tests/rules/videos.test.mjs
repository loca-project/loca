/**
 * 動画の索引 videos/{videoId}（重複の禁止と、動画 URL の禁止リスト）のルール。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { newMarker, seed, setupEnv, stampedWrite, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, async (db) => {
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
    await setDoc(doc(db, 'markers', 'm1'), storedMarker('alice', { videoId: 'aaaaaaaaaaa', youtubeUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }));
    await setDoc(doc(db, 'videos', 'aaaaaaaaaaa'), { markerId: 'm1', ownerUid: 'alice' });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

describe('二重登録と URL の形', () => {
  it('登録済みの動画は、別の利用者でも作れない', async () => {
    await assertFails(stampedWrite(as('bob'), 'bob', 'm2', newMarker('bob', { videoId: 'aaaaaaaaaaa' })));
  });

  it('短縮 URL（youtu.be）での登録は拒否（正規の形だけを許す）', async () => {
    const data = newMarker('bob', { youtubeUrl: 'https://youtu.be/bbbbbbbbbbb', videoId: 'bbbbbbbbbbb' });
    await assertFails(stampedWrite(as('bob'), 'bob', 'm2', data));
  });

  it('索引なしの作成は拒否', async () => {
    await assertFails(stampedWrite(as('bob'), 'bob', 'm2', newMarker('bob'), 'set', { index: false }));
  });
});

describe('索引の削除', () => {
  it('表示中のマーカーの索引は、本人でも外せない', async () => {
    await assertFails(deleteDoc(doc(as('alice'), 'videos', 'aaaaaaaaaaa')));
  });

  it('論理削除と同じバッチなら、本人は外せる', async () => {
    const db = as('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'rateLimits', 'alice'), { lastWriteAt: serverTimestamp(), target: 'm1' });
    batch.update(doc(db, 'markers', 'm1'), { deleted: true, updatedAt: serverTimestamp() });
    batch.delete(doc(db, 'videos', 'aaaaaaaaaaa'));
    await assertSucceeds(batch.commit());
  });

  it('他人の索引は外せない', async () => {
    await assertFails(deleteDoc(doc(as('bob'), 'videos', 'aaaaaaaaaaa')));
  });
});

describe('禁止リスト（blocked）', () => {
  it('管理者は、まだ登録されていない動画を前もって禁止できる', async () => {
    await assertSucceeds(setDoc(doc(as('root'), 'videos', 'ccccccccccc'), { blocked: true, reason: 'スパム' }));
  });

  it('一般の利用者は禁止の印を作れない', async () => {
    await assertFails(setDoc(doc(as('bob'), 'videos', 'ccccccccccc'), { blocked: true, reason: 'いたずら' }));
  });

  it('管理者は登録済みの動画に禁止の印を付けられる', async () => {
    await assertSucceeds(updateDoc(doc(as('root'), 'videos', 'aaaaaaaaaaa'), { blocked: true }));
  });

  it('禁止の印が付いた索引は、論理削除と同じバッチでも本人には外せない', async () => {
    await seed(env, (db) => updateDoc(doc(db, 'videos', 'aaaaaaaaaaa'), { blocked: true }));
    const db = as('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'rateLimits', 'alice'), { lastWriteAt: serverTimestamp(), target: 'm1' });
    batch.update(doc(db, 'markers', 'm1'), { deleted: true, updatedAt: serverTimestamp() });
    batch.delete(doc(db, 'videos', 'aaaaaaaaaaa'));
    await assertFails(batch.commit());
  });
});
