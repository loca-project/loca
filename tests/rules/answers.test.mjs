/**
 * 撮影リクエストへの回答（マーカーの answers・requests の受け取り・answerCounts）のルール（T43・ADR 0028）。
 * alice が頼み（r1: 熱量 3、r2: 熱量 2）、bob が動画 m1 で応え、alice が受け取る。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { expireStamp, newMarker, resetFirestore, seed, setupEnv, stampedWrite, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });

const past = Timestamp.fromMillis(Date.parse('2025-12-01T00:00:00Z'));
const later = Timestamp.fromMillis(Date.parse('2026-02-01T00:00:00Z'));
// マーカー（storedMarker）は 2026-01-01 に 35.681, 139.767 にある。リクエストはその前に、その近くで作られている
const request = (uid, heat, overrides = {}) => ({
  lat: 35.68, lng: 139.77, heat, equipment: { category: '', manufacturer: '', series: '', model: '' },
  ownerUid: uid, createdAt: past, updatedAt: past, withdrawn: false, ...overrides,
});

beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'requests', 'r1'), request('alice', 3));
    await setDoc(doc(db, 'requests', 'r2'), request('alice', 2));
    await setDoc(doc(db, 'requests', 'r9'), request('bob', 1));
    await setDoc(doc(db, 'heatBudgets', 'alice'), { used: 5, target: 'r2' });
    await setDoc(doc(db, 'heatBudgets', 'bob'), { used: 1, target: 'r9' });
    await setDoc(doc(db, 'markers', 'm1'), storedMarker('bob', { answers: ['r1', 'r2', 'r9'] }));
    await setDoc(doc(db, 'markers', 'm2'), storedMarker('carol'));
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

/** アプリと同じ書き込み: リクエストの取り下げ（answeredBy）・熱量の印・炎の集計を一度に書く（アプリはトランザクション、ここはバッチ）。 */
function receive(db, uid, { requestId, heat, markerId = 'm1', used, before = { heat: 0, count: 0 }, overrides = {} }) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'requests', requestId), { withdrawn: true, updatedAt: serverTimestamp(), answeredBy: markerId });
  batch.set(doc(db, 'heatBudgets', uid), { used, target: requestId });
  batch.set(doc(db, 'answerCounts', markerId), {
    heat: before.heat + heat, count: before.count + 1, ownerUid: 'bob', last: requestId, ...overrides,
  });
  return batch.commit();
}

describe('応える（マーカーの answers）', () => {
  it('作成のときに付けられる', async () => {
    await assertSucceeds(stampedWrite(as('carol'), 'carol', 'm3', newMarker('carol', { answers: ['r1'] })));
  });

  it('空・11 件以上・重複は拒否', async () => {
    const db = as('carol');
    await assertFails(stampedWrite(db, 'carol', 'm3', newMarker('carol', { answers: [] })));
    await assertFails(stampedWrite(db, 'carol', 'm4', newMarker('carol', { answers: Array.from({ length: 11 }, (_, i) => `r${i}`) })));
    await assertFails(stampedWrite(db, 'carol', 'm5', newMarker('carol', { answers: ['r1', 'r1'] })));
  });

  it('ちょうど 10 件は付けられる', async () => {
    await assertSucceeds(stampedWrite(as('carol'), 'carol', 'm3', newMarker('carol', { answers: Array.from({ length: 10 }, (_, i) => `r${i}`) })));
  });

  it('41 字の ID・文字列でない要素・コンマ入りの ID は拒否', async () => {
    const db = as('carol');
    await assertFails(stampedWrite(db, 'carol', 'm3', newMarker('carol', { answers: ['a'.repeat(41)] })));
    await assertFails(stampedWrite(db, 'carol', 'm4', newMarker('carol', { answers: [123] })));
    await assertFails(stampedWrite(db, 'carol', 'm5', newMarker('carol', { answers: [{ id: 'r1' }] })));
    await assertFails(stampedWrite(db, 'carol', 'm6', newMarker('carol', { answers: ['r1,r2'] })));
  });

  it('本人でも作成のあとは付けられない・差し替えられない（ほかの項目の更新は通る）', async () => {
    await expireStamp(env, 'carol');
    await assertSucceeds(stampedWrite(as('carol'), 'carol', 'm2', { title: '直した題名', updatedAt: serverTimestamp() }, 'update'));
    await expireStamp(env, 'carol');
    await assertFails(stampedWrite(as('carol'), 'carol', 'm2', { answers: ['r1'], updatedAt: serverTimestamp() }, 'update'));
    await expireStamp(env, 'bob');
    await assertFails(stampedWrite(as('bob'), 'bob', 'm1', { answers: ['r1'], updatedAt: serverTimestamp() }, 'update'));
  });

  it('10 件に応えた動画も、本人が編集・論理削除でき、管理者が戻せる（式の数の上限に当たらない）', async () => {
    const answers = Array.from({ length: 10 }, (_, i) => `request${String(i).padStart(12, '0')}`);
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm9'), storedMarker('bob', { answers })));
    await expireStamp(env, 'bob');
    await assertSucceeds(stampedWrite(as('bob'), 'bob', 'm9', { title: '直した題名', updatedAt: serverTimestamp() }, 'update'));
    await assertSucceeds(updateDoc(doc(as('bob'), 'markers', 'm9'), { deleted: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('root'), 'markers', 'm9'), { deleted: false, updatedAt: serverTimestamp() }));
  });

  it('管理者は外す向きだけ変えられる', async () => {
    const db = as('root');
    await assertFails(updateDoc(doc(db, 'markers', 'm1'), { answers: ['r1', 'r2', 'r9', 'r5'], updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'markers', 'm1'), { answers: ['r1', 'r2'], updatedAt: serverTimestamp() }));
  });
});

describe('受け取る', () => {
  it('依頼者は受け取れる。熱量が戻り、炎と件数が足される', async () => {
    await assertSucceeds(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2 }));
    const counts = (await getDoc(doc(as('alice'), 'answerCounts', 'm1'))).data();
    await assertSucceeds(receive(as('alice'), 'alice', { requestId: 'r2', heat: 2, used: 0, before: counts }));
    const after = (await getDoc(doc(as('alice'), 'answerCounts', 'm1'))).data();
    if (after.heat !== 5 || after.count !== 2) throw new Error(`炎 ${after.heat}・件数 ${after.count}`);
  });

  it('炎や件数を多く足すのは拒否', async () => {
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 4, used: 2 }));
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2, overrides: { count: 2 } }));
  });

  it('熱量の印を戻さない受け取りは拒否', async () => {
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 5 }));
  });

  it('応えていないマーカーでは受け取れない', async () => {
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2, markerId: 'm2', overrides: { ownerUid: 'carol' } }));
  });

  it('自分のリクエストに自分の動画では受け取れない', async () => {
    await assertFails(receive(as('bob'), 'bob', { requestId: 'r9', heat: 1, used: 0 }));
  });

  it('ほかの人のリクエストは受け取れない', async () => {
    await assertFails(receive(as('carol'), 'alice', { requestId: 'r1', heat: 3, used: 2 }));
  });

  it('論理削除されたマーカーでは受け取れない', async () => {
    await seed(env, (db) => updateDoc(doc(db, 'markers', 'm1'), { deleted: true }));
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2 }));
  });

  it('投稿者の uid を偽った炎は拒否', async () => {
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2, overrides: { ownerUid: 'alice' } }));
  });

  it('炎の集計だけ（受け取りなし）は書けない', async () => {
    await assertFails(setDoc(doc(as('alice'), 'answerCounts', 'm1'), { heat: 3, count: 1, ownerUid: 'bob', last: 'r1' }));
  });

  it('受け取り済みのリクエストは、もう一度受け取れない', async () => {
    await receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2 });
    const counts = (await getDoc(doc(as('alice'), 'answerCounts', 'm1'))).data();
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 0, before: counts }));
  });

  it('管理者でも、ほかの人のリクエストを受け取りとして閉じられない', async () => {
    await assertFails(receive(as('root'), 'alice', { requestId: 'r1', heat: 3, used: 2 }));
  });

  it('マーカーより後に作られたリクエスト（物理削除のあと同じ ID で作り直した）は、炎を書かずにも書いても受け取れない', async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'requests', 'r1'), request('alice', 3, { createdAt: later, updatedAt: later }));
      await setDoc(doc(db, 'answerCounts', 'm1'), { heat: 3, count: 1, ownerUid: 'bob', last: 'r1' });
    });
    const db = as('alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'requests', 'r1'), { withdrawn: true, updatedAt: serverTimestamp(), answeredBy: 'm1' });
    batch.set(doc(db, 'heatBudgets', 'alice'), { used: 2, target: 'r1' });
    await assertFails(batch.commit());
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2, before: { heat: 3, count: 1 } }));
  });

  it('遠い場所のマーカーでは受け取れない', async () => {
    await seed(env, (db) => setDoc(doc(db, 'requests', 'r1'), request('alice', 3, { lat: 34.7, lng: 135.5 })));
    await assertFails(receive(as('alice'), 'alice', { requestId: 'r1', heat: 3, used: 2 }));
  });

  it('炎の集計は誰でも読める', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'answerCounts', 'm1')));
  });

  it('今までの取り下げ（answeredBy なし）はそのまま通る', async () => {
    const db = as('alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'requests', 'r2'), { withdrawn: true, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'heatBudgets', 'alice'), { used: 3, target: 'r2' });
    await assertSucceeds(batch.commit());
  });
});
