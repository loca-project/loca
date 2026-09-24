/**
 * users コレクション（プロフィール）のルールと、未登録の利用者が書き込めないこと（要件 1.1・2.5・2.6・ADR 0019）。
 * dave は未登録（resetFirestore が置く REGISTERED に含めない）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { newMarker, resetFirestore, seed, setupEnv, stampedWrite, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, (db) => setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' }));
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();

function profile(overrides = {}) {
  return {
    nickname: 'だいち',
    consentVersion: 1,
    agreedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('登録（作成）', () => {
  it('本人が同意の版 1 とサーバー時刻で登録できる', async () => {
    await assertSucceeds(setDoc(doc(as('dave'), 'users', 'dave'), profile()));
  });

  it('他人の uid では登録できない', async () => {
    await assertFails(setDoc(doc(as('dave'), 'users', 'erin'), profile()));
  });

  it('未ログインは登録できない', async () => {
    await assertFails(setDoc(doc(guest(), 'users', 'dave'), profile()));
  });

  it('同意日時が端末の時計・同意の版が 1 以外なら拒否', async () => {
    const past = Timestamp.fromMillis(Date.parse('2026-01-01T00:00:00Z'));
    await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), profile({ agreedAt: past })));
    await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), profile({ consentVersion: 2 })));
  });

  it('メールなど決めていない項目は保存させない', async () => {
    await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), profile({ email: 'dave@example.com' })));
  });

  it('ニックネームは 1〜20 字・改行なし・前後の空白なし', async () => {
    await assertSucceeds(setDoc(doc(as('dave'), 'users', 'dave'), profile({ nickname: 'あ'.repeat(20) })));
    for (const nickname of ['', 'あ'.repeat(21), 'だい\nち', ' だいち']) {
      await assertFails(setDoc(doc(as('carol'), 'users', 'carol'), profile({ nickname })));
    }
  });

  it('ブラックリストの利用者は登録できない', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'dave'), { reason: 'スパム' }));
    await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), profile()));
  });
});

describe('閲覧・編集・削除', () => {
  it('読めるのは本人と管理者だけ', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users', 'alice')));
    await assertSucceeds(getDoc(doc(as('root'), 'users', 'alice')));
    await assertFails(getDoc(doc(as('bob'), 'users', 'alice')));
    await assertFails(getDoc(doc(guest(), 'users', 'alice')));
  });

  it('本人はニックネームを変えられる', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users', 'alice'), { nickname: 'ありす', updatedAt: serverTimestamp() }));
  });

  it('同意の記録と登録日は変えられない', async () => {
    const ref = doc(as('alice'), 'users', 'alice');
    await assertFails(updateDoc(ref, { agreedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });

  it('他人のニックネームは変えられない', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'users', 'alice'), { nickname: 'x', updatedAt: serverTimestamp() }));
  });

  it('本人は消せない（アカウント削除は T54）。管理者は消せる', async () => {
    await assertFails(deleteDoc(doc(as('alice'), 'users', 'alice')));
    await assertSucceeds(deleteDoc(doc(as('root'), 'users', 'alice')));
  });
});

describe('未登録の利用者は書き込めない（要件 1.1）', () => {
  it('マーカーを投稿できない', async () => {
    await assertFails(stampedWrite(as('dave'), 'dave', 'm1', newMarker('dave', { createdBy: 'dave さん' })));
  });

  it('登録済みでも、投稿者名がニックネームと違えば拒否', async () => {
    await assertFails(stampedWrite(as('alice'), 'alice', 'm1', newMarker('alice', { createdBy: '別の名前' })));
  });

  it('撮影リクエストを作れない', async () => {
    const db = as('dave');
    const batch = writeBatch(db);
    batch.set(doc(db, 'requests', 'r1'), {
      lat: 35, lng: 135, heat: 1,
      equipment: { category: '', manufacturer: '', series: '', model: '' },
      ownerUid: 'dave', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'heatBudgets', 'dave'), { used: 1, target: 'r1' });
    await assertFails(batch.commit());
  });

  it('通報できない', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice')));
    await assertFails(setDoc(doc(as('dave'), 'reports', 'm1_dave'), {
      markerId: 'm1', reporterUid: 'dave', reasons: ['copyright'], status: 'open',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });
});
