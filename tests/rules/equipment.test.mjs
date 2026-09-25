/**
 * 機器マスタ equipmentMaster/{分類のキー} のルール（ADR 0025・T28）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { seed, resetFirestore, setupEnv } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
    await setDoc(doc(db, 'blacklist', 'root2'), { blocked: true, reason: '試験' });
    await setDoc(doc(db, 'admins', 'root2'), { note: 'ブラックリストの管理者' });
    await setDoc(doc(db, 'equipmentMaster', 'action'), { makers: [], updatedAt: new Date(0), updatedBy: 'root' });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();
const makers = [{ name: 'GoPro', series: [{ name: 'HERO', models: ['HERO13 Black'] }] }];
const master = (overrides = {}) => ({ makers, updatedAt: serverTimestamp(), ...overrides });

describe('機器マスタの読み取り', () => {
  it('未ログインでも読める（同期が API キーだけで読む）', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'equipmentMaster', 'action')));
  });

  it('未ログインでも一覧を読める（同期は list で読む）', async () => {
    await assertSucceeds(getDocs(collection(guest(), 'equipmentMaster')));
  });
});

describe('機器マスタの書き込み', () => {
  it('管理者は分類の文書を作れる・置き換えられる', async () => {
    await assertSucceeds(setDoc(doc(as('root'), 'equipmentMaster', 'drone'), master()));
    await assertSucceeds(setDoc(doc(as('root'), 'equipmentMaster', 'action'), master()));
  });

  it('管理者でない人・未ログインは書けない', async () => {
    await assertFails(setDoc(doc(as('alice'), 'equipmentMaster', 'drone'), master()));
    await assertFails(setDoc(doc(guest(), 'equipmentMaster', 'drone'), master()));
    await assertFails(setDoc(doc(as('alice'), 'equipmentMaster', 'action'), master()));
  });

  it('ブラックリストの管理者は書けない', async () => {
    await assertFails(setDoc(doc(as('root2'), 'equipmentMaster', 'drone'), master()));
  });

  it('知らない分類は作れない（分類の追加はコードの変更）', async () => {
    await assertFails(setDoc(doc(as('root'), 'equipmentMaster', 'tripod'), master()));
  });

  it('形が違うものは拒む（余計な項目・一覧でない・件数の上限・時刻・項目の欠け）', async () => {
    const db = as('root');
    const ref = doc(db, 'equipmentMaster', 'drone');
    await assertFails(setDoc(ref, master({ note: 'x' })));
    await assertFails(setDoc(ref, master({ makers: 'DJI' })));
    await assertFails(setDoc(ref, master({ makers: Array.from({ length: 61 }, (_, i) => ({ name: `M${i}`, series: [] })) })));
    await assertFails(setDoc(ref, master({ updatedAt: new Date(0) })));
    await assertFails(setDoc(ref, master({ updatedBy: 'root' })));
    await assertFails(setDoc(ref, { makers }));
  });

  it('誰も消せない（「既定に戻す」は置かない）', async () => {
    await assertFails(deleteDoc(doc(as('root'), 'equipmentMaster', 'action')));
    await assertFails(deleteDoc(doc(as('alice'), 'equipmentMaster', 'action')));
    await assertFails(deleteDoc(doc(guest(), 'equipmentMaster', 'action')));
    await assertFails(deleteDoc(doc(as('root2'), 'equipmentMaster', 'action')));
  });
});
