/**
 * アカウント削除に要るルール（要件 2.7・ADR 0021）。
 * 本人の論理削除は印なしで通る / 本人はプロフィールと名前の索引を同じバッチで消せる。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { resetFirestore, seed, setupEnv, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'markers', 'm1'), storedMarker('alice'));
    await setDoc(doc(db, 'markers', 'm2'), storedMarker('alice', { deleted: true }));
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const softDelete = (uid, id, extra = {}) =>
  updateDoc(doc(as(uid), 'markers', id), { deleted: true, updatedAt: serverTimestamp(), ...extra });

describe('本人の論理削除は印なしで通る', () => {
  it('本人は印なしで論理削除できる', async () => {
    await assertSucceeds(softDelete('alice', 'm1'));
  });

  it('ほかの項目を一緒に変えるのは拒否', async () => {
    await assertFails(softDelete('alice', 'm1', { title: '書き換え' }));
  });

  it('他人のマーカーは消せない', async () => {
    await assertFails(softDelete('bob', 'm1'));
  });

  it('論理削除済みをもう一度消す（updatedAt だけ進める）のは拒否', async () => {
    await assertFails(softDelete('alice', 'm2'));
  });

  it('本人が戻す（deleted: false）のは拒否', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'markers', 'm2'), { deleted: false, updatedAt: serverTimestamp() }));
  });
});

describe('プロフィールの削除', () => {
  it('本人はプロフィールと名前の索引を同じバッチで消せる', async () => {
    const db = as('alice');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', 'alice'));
    batch.delete(doc(db, 'nicknames', 'alice さん'));
    await assertSucceeds(batch.commit());
  });

  it('他人のプロフィールは消せない', async () => {
    await assertFails(deleteDoc(doc(as('bob'), 'users', 'alice')));
  });

  it('プロフィールを残したまま、いまの名前の索引だけを消すのは拒否', async () => {
    await assertFails(deleteDoc(doc(as('alice'), 'nicknames', 'alice さん')));
  });

  it('ブラックリストの利用者は消せない', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'mallory'), { reason: 'スパム' }));
    await assertFails(deleteDoc(doc(as('mallory'), 'users', 'mallory')));
  });
});
