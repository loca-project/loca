/**
 * markers コレクションのルール（ADR 0010「要件ごとの実装可否」の ○ の行）。
 * 1.1 未認証では書けない / 3.x 本人のみ更新・論理削除 / 1.4 誰でも読める / 入力の検証
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { expireStamp, newMarker, seed, setupEnv, stampedWrite, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const guest = () => env.unauthenticatedContext().firestore();

describe('1.1 未認証では登録させない', () => {
  it('未認証の作成は拒否', async () => {
    await assertFails(setDoc(doc(guest(), 'markers', 'm1'), newMarker('anon')));
  });

  it('ログイン済みで印付きの作成は許可', async () => {
    await assertSucceeds(stampedWrite(alice(), 'alice', 'm1', newMarker('alice')));
  });

  it('レートリミットの印が無い作成は拒否', async () => {
    await assertFails(setDoc(doc(alice(), 'markers', 'm1'), newMarker('alice')));
  });

  it('他人の uid を ownerUid にした作成は拒否', async () => {
    await assertFails(stampedWrite(alice(), 'alice', 'm1', newMarker('bob')));
  });

  it('作成時に deleted: true は拒否', async () => {
    await assertFails(stampedWrite(alice(), 'alice', 'm1', newMarker('alice', { deleted: true })));
  });
});

describe('1.4 閲覧は誰でも可', () => {
  it('未認証でも読める（論理削除済みを含む）', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice', { deleted: true })));
    await assertSucceeds(getDoc(doc(guest(), 'markers', 'm1')));
  });
});

describe('3.x 本人のみ更新・論理削除', () => {
  beforeEach(async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice')));
  });

  it('本人の更新は許可', async () => {
    const change = { title: '直した', updatedAt: serverTimestamp() };
    await assertSucceeds(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });

  it('本人の論理削除は許可', async () => {
    const change = { deleted: true, updatedAt: serverTimestamp() };
    await assertSucceeds(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });

  it('他人の更新は拒否', async () => {
    const change = { title: '乗っ取り', updatedAt: serverTimestamp() };
    await assertFails(stampedWrite(bob(), 'bob', 'm1', change, 'update'));
  });

  it('本人でも物理削除は拒否', async () => {
    await assertFails(deleteDoc(doc(alice(), 'markers', 'm1')));
  });

  it('本人でも ownerUid・createdAt は変えられない', async () => {
    const change = { ownerUid: 'bob', updatedAt: serverTimestamp() };
    await assertFails(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });

  it('updatedAt をサーバー時刻にしない更新は拒否', async () => {
    await assertFails(stampedWrite(alice(), 'alice', 'm1', { title: '直した' }, 'update'));
  });

  it('論理削除済みを本人が戻すのは拒否', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice', { deleted: true })));
    const change = { deleted: false, updatedAt: serverTimestamp() };
    await assertFails(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });

  it('間隔を空ければ続けて更新できる', async () => {
    await expireStamp(env, 'alice');
    const change = { title: '2 回目', updatedAt: serverTimestamp() };
    await assertSucceeds(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });
});

describe('入力の検証', () => {
  const cases = [
    ['緯度が範囲外', { lat: 91 }],
    ['経度が文字列', { lng: '139' }],
    ['YouTube 以外の URL', { youtubeUrl: 'https://example.com/watch?v=x' }],
    ['知らない項目', { likes: 100 }],
    ['感情タグの欠け', { tags: { action: '', atmosphere: '' } }],
    ['タイトルが長すぎる', { title: 'あ'.repeat(301) }],
    ['必須の createdBy が無い', { createdBy: undefined }],
  ];
  for (const [label, overrides] of cases) {
    it(`${label} は拒否`, async () => {
      const data = newMarker('alice', overrides);
      for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
      await assertFails(stampedWrite(alice(), 'alice', 'm1', data));
    });
  }
});
