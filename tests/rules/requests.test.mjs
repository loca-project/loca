/**
 * 撮影リクエスト（requests）と熱量の上限（heatBudgets）のルール。
 * 熱量は 1〜5、1 利用者が使える合計も 5 まで（用語集「熱量」）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { seed, setupEnv } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();

function newRequest(uid, heat, overrides = {}) {
  return {
    lat: 35.0, lng: 135.0, heat,
    equipment: { manufacturer: '', series: '', model: '' },
    ownerUid: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** アプリと同じ手順: リクエストと熱量の印を同じバッチで書く。 */
function budgetedWrite(db, uid, requestId, data, used) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'requests', requestId), data);
  batch.set(doc(db, 'heatBudgets', uid), { used, target: requestId });
  return batch.commit();
}

describe('作成', () => {
  it('熱量と印が合っていれば作成できる', async () => {
    await assertSucceeds(budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3));
  });

  it('2 件目は前回の合計に足した値で作成できる（合計 5 まで）', async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
    await assertSucceeds(budgetedWrite(as('alice'), 'alice', 'r2', newRequest('alice', 2), 5));
  });

  it('合計が 5 を超えるなら拒否', async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
    await assertFails(budgetedWrite(as('alice'), 'alice', 'r2', newRequest('alice', 3), 6));
  });

  it('合計を少なく申告しても拒否（前回 3 に 3 足して used: 3）', async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
    await assertFails(budgetedWrite(as('alice'), 'alice', 'r2', newRequest('alice', 3), 3));
  });

  it('印の無い作成は拒否', async () => {
    await assertFails(setDoc(doc(as('alice'), 'requests', 'r1'), newRequest('alice', 1)));
  });

  it('未ログインは拒否', async () => {
    await assertFails(budgetedWrite(guest(), 'anon', 'r1', newRequest('anon', 1), 1));
  });

  it('他人の uid を ownerUid にした作成は拒否', async () => {
    await assertFails(budgetedWrite(as('alice'), 'alice', 'r1', newRequest('bob', 1), 1));
  });

  it('熱量 0 と 6 は拒否', async () => {
    await assertFails(budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 0), 0));
    await assertFails(budgetedWrite(as('alice'), 'alice', 'r2', newRequest('alice', 6), 6));
  });

  it('季節・時間帯・撮り方は動画のタグと同じキーで持てる（ADR 0014）', async () => {
    const data = newRequest('alice', 1, { season: 'autumn', timeOfDay: 'night', style: 'aerial' });
    await assertSucceeds(budgetedWrite(as('alice'), 'alice', 'r1', data, 1));
  });

  it('一覧に無い語・旧形式の撮影雰囲気・空文字は拒否', async () => {
    const bad = [{ season: '秋' }, { timeOfDay: 'noon' }, { style: '空撮/景観' }, { atmosphere: '散策' }, { season: '' }];
    for (const [i, overrides] of bad.entries()) {
      await assertFails(budgetedWrite(as('alice'), 'alice', `r${i}`, newRequest('alice', 1, overrides), 1));
    }
  });

  it('ブラックリストの利用者は拒否', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'mallory'), { reason: 'スパム' }));
    await assertFails(budgetedWrite(as('mallory'), 'mallory', 'r1', newRequest('mallory', 1), 1));
  });
});

describe('熱量の印（heatBudgets）', () => {
  it('リクエスト無しで印だけを書き換えるのは拒否（既存のリクエストを指しても）', async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
    await assertFails(setDoc(doc(as('alice'), 'heatBudgets', 'alice'), { used: 1, target: 'r1' }));
  });

  it('印は消せない（上限のリセットを防ぐ）', async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
    await assertFails(deleteDoc(doc(as('alice'), 'heatBudgets', 'alice')));
  });

  it('本人だけが読める', async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
    await assertSucceeds(getDoc(doc(as('alice'), 'heatBudgets', 'alice')));
    await assertFails(getDoc(doc(as('bob'), 'heatBudgets', 'alice')));
  });
});

/** アプリと同じ手順の取り下げ（論理削除）: withdrawn を立てるのと熱量の印の減算を同じバッチで。 */
function withdraw(db, uid, requestId, used) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'requests', requestId), { withdrawn: true, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'heatBudgets', uid), { used, target: requestId });
  return batch.commit();
}

describe('取り下げ（熱量が戻る）', () => {
  beforeEach(async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
    await budgetedWrite(as('alice'), 'alice', 'r2', newRequest('alice', 2), 5);
  });

  it('本人は、熱量の印を減らして取り下げられる', async () => {
    await assertSucceeds(withdraw(as('alice'), 'alice', 'r1', 2));
  });

  it('取り下げた分の熱量で、また作成できる（合計 5 まで）', async () => {
    await withdraw(as('alice'), 'alice', 'r1', 2);
    await assertSucceeds(budgetedWrite(as('alice'), 'alice', 'r3', newRequest('alice', 3), 5));
  });

  it('減らす量が熱量と合わなければ拒否（多く戻そうとする）', async () => {
    await assertFails(withdraw(as('alice'), 'alice', 'r1', 0));
  });

  it('印を減らさない取り下げは拒否', async () => {
    const ref = doc(as('alice'), 'requests', 'r1');
    await assertFails(updateDoc(ref, { withdrawn: true, updatedAt: serverTimestamp() }));
  });

  it('取り下げ済みをもう一度取り下げて熱量を二重に戻すのは拒否', async () => {
    await withdraw(as('alice'), 'alice', 'r1', 2);
    await assertFails(withdraw(as('alice'), 'alice', 'r1', 0));
  });

  it('本人でも物理削除は拒否（取り下げは論理削除だけ。ADR 0013）', async () => {
    await assertFails(deleteDoc(doc(as('alice'), 'requests', 'r1')));
  });

  it('取り下げと一緒に熱量など他の項目は変えられない', async () => {
    const db = as('alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'requests', 'r1'), { withdrawn: true, heat: 1, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'heatBudgets', 'alice'), { used: 2, target: 'r1' });
    await assertFails(batch.commit());
  });

  it('他人のリクエストは取り下げられない', async () => {
    await assertFails(withdraw(as('bob'), 'bob', 'r1', 0));
  });

  it('リクエストを消さずに印だけ減らすのは拒否', async () => {
    await assertFails(setDoc(doc(as('alice'), 'heatBudgets', 'alice'), { used: 2, target: 'r1' }));
  });
});

describe('閲覧・変更・削除', () => {
  beforeEach(async () => {
    await budgetedWrite(as('alice'), 'alice', 'r1', newRequest('alice', 3), 3);
  });

  it('未ログインでも読める', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'requests', 'r1')));
  });

  it('本人でも変更できない', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'requests', 'r1'), { heat: 1, updatedAt: serverTimestamp() }));
  });

  it('管理者は印なしで削除できる', async () => {
    await seed(env, (db) => setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' }));
    await assertSucceeds(deleteDoc(doc(as('root'), 'requests', 'r1')));
  });
});
