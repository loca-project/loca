/**
 * 通報 reports/{markerId}_{uid} のルール（要件 3.8）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { seed, setupEnv, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, async (db) => {
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
    await setDoc(doc(db, 'markers', 'm1'), storedMarker('alice'));
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();

function report(uid, overrides = {}) {
  return {
    markerId: 'm1',
    reporterUid: uid,
    reasons: ['copyright'],
    detail: '本人の動画ではないと思います',
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('通報の作成', () => {
  it('ログインしていれば通報できる', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob')));
  });

  it('同じ人の 2 回目を作り直す（作成日時を変える）のは拒否。1 人 1 件で人数を数えるため', async () => {
    await setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob'));
    await assertFails(setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob', { reasons: ['illegal'] })));
  });

  it('ID が「マーカー_本人」でなければ拒否（他人になりすます）', async () => {
    await assertFails(setDoc(doc(as('bob'), 'reports', 'm1_carol'), report('bob')));
  });

  it('未ログインは拒否', async () => {
    await assertFails(setDoc(doc(guest(), 'reports', 'm1_anon'), report('anon')));
  });

  it('理由が空・知らない理由は拒否', async () => {
    await assertFails(setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob', { reasons: [] })));
    await assertFails(setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob', { reasons: ['spam'] })));
  });

  it('詳細が 1000 字を超えると拒否', async () => {
    await assertFails(setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob', { detail: 'あ'.repeat(1001) })));
  });

  it('存在しないマーカーへの通報は拒否', async () => {
    await assertFails(setDoc(doc(as('bob'), 'reports', 'm9_bob'), report('bob', { markerId: 'm9' })));
  });
});

describe('通報の閲覧と対応', () => {
  beforeEach(async () => {
    await setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob'));
  });

  it('通報した本人と管理者は読める。他人は読めない', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'reports', 'm1_bob')));
    await assertSucceeds(getDoc(doc(as('root'), 'reports', 'm1_bob')));
    await assertFails(getDoc(doc(as('alice'), 'reports', 'm1_bob')));
  });

  it('対応済みにできるのは管理者だけ', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), { status: 'resolved', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('root'), 'reports', 'm1_bob'), { status: 'resolved' }));
  });
});

describe('同じ人の 2 回目（理由と詳細の更新）', () => {
  beforeEach(async () => {
    await setDoc(doc(as('bob'), 'reports', 'm1_bob'), report('bob'));
  });

  const again = (overrides = {}) => ({ reasons: ['illegal', 'harassment'], detail: '追記', status: 'open', updatedAt: serverTimestamp(), ...overrides });

  it('本人は理由と詳細を更新できる', async () => {
    await assertSucceeds(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again()));
  });

  it('管理者が対応済みにした通報も、本人の再通報で確認待ちに戻せる', async () => {
    await updateDoc(doc(as('root'), 'reports', 'm1_bob'), { status: 'resolved' });
    await assertSucceeds(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again()));
  });

  it('本人でも通報者・マーカー・作成日時は変えられない', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again({ reporterUid: 'carol' })));
    await assertFails(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again({ markerId: 'm2' })));
    await assertFails(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again({ createdAt: serverTimestamp() })));
  });

  it('更新でも理由が空・知らない理由・updatedAt がサーバー時刻でないものは拒否', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again({ reasons: [] })));
    await assertFails(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again({ reasons: ['spam'] })));
    await assertFails(updateDoc(doc(as('bob'), 'reports', 'm1_bob'), again({ updatedAt: new Date() })));
  });

  it('他人の通報は更新できない', async () => {
    await assertFails(updateDoc(doc(as('carol'), 'reports', 'm1_bob'), again()));
  });
});
