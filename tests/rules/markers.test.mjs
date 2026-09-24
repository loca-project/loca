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
    ['映っているものの欠け', { tags: { mood: 'calm' } }],
    ['雰囲気が一覧に無い', { tags: { subject: 'nature', mood: 'happy' } }],
    ['旧形式の感情タグ', { tags: { action: 'a', atmosphere: 'b', emotion: 'c' } }],
    ['撮影の季節が一覧に無い', { tags: { subject: 'nature', mood: 'calm', season: 'rainy' } }],
    ['タグに知らない項目', { tags: { subject: 'nature', mood: 'calm', weather: 'sunny' } }],
    ['現地メモが 81 字', { memo: 'あ'.repeat(81) }],
    ['現地メモが空', { memo: '' }],
    ['現地メモに改行', { memo: '1 行目\n2 行目' }],
    ['機器の分類が一覧に無い', { equipment: { category: 'tripod', manufacturer: '', series: '', model: '' } }],
    ['機器に分類が無い（旧形式）', { equipment: { manufacturer: 'DJI', series: '', model: '' } }],
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

  const accepted = [
    ['任意のタグをすべて埋めたもの', {
      tags: { subject: 'festival', mood: 'lively', season: 'summer', timeOfDay: 'night', style: 'walking' },
    }],
    ['現地メモが 80 字', { memo: 'あ'.repeat(80) }],
    ['機器を 4 段で指定', { equipment: { category: 'drone', manufacturer: 'DJI', series: 'Mini', model: 'Mini 4 Pro' } }],
    ['機器を分類だけ指定', { equipment: { category: 'other', manufacturer: '', series: '', model: '' } }],
  ];
  for (const [label, overrides] of accepted) {
    it(`${label} は通る`, async () => {
      await assertSucceeds(stampedWrite(alice(), 'alice', 'm1', newMarker('alice', overrides)));
    });
  }
});

describe('Actions だけが書く項目（youtube・deletedReason。ADR 0017）', () => {
  const stats = { viewCount: 10, durationSec: 60, publishedAt: '2026-01-02T03:04:05Z' };

  it('作成に youtube を含めるのは拒否', async () => {
    await assertFails(stampedWrite(alice(), 'alice', 'm1', newMarker('alice', { youtube: stats })));
  });

  it('youtube を持つマーカーでも、本人は他の項目を更新できる', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice', { youtube: stats })));
    const change = { title: '直した', updatedAt: serverTimestamp() };
    await assertSucceeds(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });

  it('本人が youtube を書き換えるのは拒否', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice', { youtube: stats })));
    const change = { youtube: { ...stats, viewCount: 999999 }, updatedAt: serverTimestamp() };
    await assertFails(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });

  it('本人が deletedReason を付けるのは拒否', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice')));
    const change = { deleted: true, deletedReason: 'unavailable', updatedAt: serverTimestamp() };
    await assertFails(stampedWrite(alice(), 'alice', 'm1', change, 'update'));
  });
});
