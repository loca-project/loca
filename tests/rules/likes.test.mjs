/**
 * いいね likes/{markerId}_{uid} と件数 likeCounts/{markerId} のルール（ADR 0024）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { expireStamp, seed, resetFirestore, setupEnv, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
    await setDoc(doc(db, 'markers', 'm1'), storedMarker('alice'));
    await setDoc(doc(db, 'markers', 'gone'), storedMarker('alice', { deleted: true }));
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();

/**
 * アプリと同じ手順で付ける・外す: いいね・件数・（付けるときだけ）印を同じバッチで書く。
 * count は書き込み後の件数。overrides でいいねの項目を、stamp: false で印を省ける。
 */
function toggle(uid, markerId, { on, count, created = true, stamp = on, overrides = {}, owner = 'alice' }) {
  const db = as(uid);
  const batch = writeBatch(db);
  const like = doc(db, 'likes', `${markerId}_${uid}`);
  if (created) {
    batch.update(like, { deleted: !on, updatedAt: serverTimestamp(), ...overrides });
  } else {
    batch.set(like, {
      markerId, likerUid: uid, deleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
    });
  }
  const counter = doc(db, 'likeCounts', markerId);
  if (count === 1 && on && !created) batch.set(counter, { count, ownerUid: owner });
  else if (count !== undefined) batch.update(counter, { count });
  if (stamp) batch.set(doc(db, 'rateLimits', uid), { lastWriteAt: serverTimestamp(), target: markerId });
  return batch.commit();
}

const likeFirst = (uid, markerId = 'm1', opts = {}) => toggle(uid, markerId, { on: true, count: 1, created: false, ...opts });

describe('いいねを付ける', () => {
  it('最初のいいねで、いいねと件数 1 を作れる', async () => {
    await assertSucceeds(likeFirst('bob'));
  });

  it('2 人目は件数を 1 増やして付けられる', async () => {
    await likeFirst('bob');
    await assertSucceeds(toggle('carol', 'm1', { on: true, count: 2, created: false }));
  });

  it('件数を動かさない・2 動かす・投稿者を偽るのは拒否', async () => {
    const db = as('bob');
    const batch = writeBatch(db);
    batch.set(doc(db, 'likes', 'm1_bob'), {
      markerId: 'm1', likerUid: 'bob', deleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'rateLimits', 'bob'), { lastWriteAt: serverTimestamp(), target: 'm1' });
    await assertFails(batch.commit());
    await likeFirst('bob');
    await assertFails(toggle('carol', 'm1', { on: true, count: 3, created: false }));
    await resetFirestore(env);
    await seed(env, (d) => setDoc(doc(d, 'markers', 'm1'), storedMarker('alice')));
    await assertFails(likeFirst('bob', 'm1', { owner: 'bob' }));
  });

  it('印（レートリミット）が無いと拒否', async () => {
    await assertFails(likeFirst('bob', 'm1', { stamp: false }));
  });

  it('自分のマーカー・論理削除されたマーカー・無いマーカーには付けられない', async () => {
    await assertFails(likeFirst('alice'));
    await assertFails(likeFirst('bob', 'gone'));
    await assertFails(likeFirst('bob', 'm9'));
  });

  it('ID が「マーカー_本人」でない・付けた人を偽るのは拒否', async () => {
    await assertFails(likeFirst('bob', 'm1', { overrides: { likerUid: 'carol' } }));
    const db = as('bob');
    const batch = writeBatch(db);
    batch.set(doc(db, 'likes', 'm1_carol'), {
      markerId: 'm1', likerUid: 'bob', deleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'likeCounts', 'm1'), { count: 1, ownerUid: 'alice' });
    batch.set(doc(db, 'rateLimits', 'bob'), { lastWriteAt: serverTimestamp(), target: 'm1' });
    await assertFails(batch.commit());
  });

  it('未ログインは拒否', async () => {
    const db = guest();
    await assertFails(setDoc(doc(db, 'likeCounts', 'm1'), { count: 1, ownerUid: 'alice' }));
  });

  it('プロフィール未登録・ブラックリストは拒否', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'carol'), { reason: 'test' }));
    await assertFails(likeFirst('carol'));
    await assertFails(likeFirst('dave'));
  });
});

describe('いいねを外す・付け直す', () => {
  beforeEach(async () => {
    await likeFirst('bob');
    await expireStamp(env, 'bob');
  });

  it('外すと件数が 1 減る。印は要らない', async () => {
    await assertSucceeds(toggle('bob', 'm1', { on: false, count: 0 }));
  });

  it('外すのに件数を減らさないのは拒否', async () => {
    await assertFails(toggle('bob', 'm1', { on: false }));
  });

  it('付け直すと件数が 1 増える（印が要る）', async () => {
    await toggle('bob', 'm1', { on: false, count: 0 });
    await assertFails(toggle('bob', 'm1', { on: true, count: 1, stamp: false }));
    await assertSucceeds(toggle('bob', 'm1', { on: true, count: 1 }));
  });

  it('付け直しも 6 秒あけないと拒否（連打で書き込みを増やさせない）', async () => {
    await toggle('bob', 'm1', { on: false, count: 0 });
    await toggle('bob', 'm1', { on: true, count: 1 });
    await toggle('bob', 'm1', { on: false, count: 0 });
    await assertFails(toggle('bob', 'm1', { on: true, count: 1 }));
  });

  it('付いたまま件数だけ増やす・他人のいいねで件数を減らすのは拒否', async () => {
    await assertFails(setDoc(doc(as('bob'), 'likeCounts', 'm1'), { count: 2, ownerUid: 'alice' }));
    await assertFails(setDoc(doc(as('carol'), 'likeCounts', 'm1'), { count: 0, ownerUid: 'alice' }));
  });

  it('他人のいいねは外せない', async () => {
    const db = as('carol');
    const batch = writeBatch(db);
    batch.update(doc(db, 'likes', 'm1_bob'), { deleted: true, updatedAt: serverTimestamp() });
    batch.update(doc(db, 'likeCounts', 'm1'), { count: 0 });
    await assertFails(batch.commit());
  });

  it('マーカーが論理削除されても外せる', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice', { deleted: true })));
    await assertSucceeds(toggle('bob', 'm1', { on: false, count: 0 }));
  });

  it('マーカーと件数が物理削除されたあとも、件数を動かさずに外せる', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const batch = writeBatch(db);
      batch.delete(doc(db, 'markers', 'm1'));
      batch.delete(doc(db, 'likeCounts', 'm1'));
      await batch.commit();
    });
    await assertSucceeds(toggle('bob', 'm1', { on: false }));
  });

  it('マーカーだけが物理削除され件数が残っていれば、件数を 1 減らして外せる', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'markers', 'm1')));
    await assertSucceeds(toggle('bob', 'm1', { on: false, count: 0 }));
  });

  it('物理削除: 本人は拒否。管理者は外したいいねだけ消せる（付いたままは件数が狂うので拒否）', async () => {
    await assertFails(deleteDoc(doc(as('bob'), 'likes', 'm1_bob')));
    await assertFails(deleteDoc(doc(as('root'), 'likes', 'm1_bob')));
    await toggle('bob', 'm1', { on: false, count: 0 });
    await assertSucceeds(deleteDoc(doc(as('root'), 'likes', 'm1_bob')));
  });

  it('件数の物理削除は、マーカーが残っていれば管理者でも拒否', async () => {
    await assertFails(deleteDoc(doc(as('root'), 'likeCounts', 'm1')));
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'markers', 'm1')));
    await assertSucceeds(deleteDoc(doc(as('root'), 'likeCounts', 'm1')));
  });

  it('外すときにマーカー・付けた人・作成日時を変える、状態を変えない空の更新は拒否', async () => {
    await assertFails(toggle('bob', 'm1', { on: false, count: 0, overrides: { markerId: 'm2' } }));
    await assertFails(toggle('bob', 'm1', { on: false, count: 0, overrides: { likerUid: 'carol' } }));
    await assertFails(toggle('bob', 'm1', { on: false, count: 0, overrides: { createdAt: serverTimestamp() } }));
    await assertFails(updateDoc(doc(as('bob'), 'likes', 'm1_bob'), { deleted: false, updatedAt: serverTimestamp() }));
  });

  it('件数の投稿者を変える・整数でない件数は拒否', async () => {
    const db = as('bob');
    const off = (counter) => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'likes', 'm1_bob'), { deleted: true, updatedAt: serverTimestamp() });
      batch.update(doc(db, 'likeCounts', 'm1'), counter);
      return batch.commit();
    };
    await assertFails(off({ count: 0, ownerUid: 'bob' }));
    await assertFails(off({ count: 0.5 }));
  });
});

describe('いいねの作成で拒否されるほかの形', () => {
  it('作成日時・更新日時がサーバー時刻でないものは拒否', async () => {
    await assertFails(likeFirst('bob', 'm1', { overrides: { createdAt: new Date() } }));
    await assertFails(likeFirst('bob', 'm1', { overrides: { updatedAt: new Date() } }));
  });

  it('いいねを伴わない件数だけの作成は、ログインしていても拒否', async () => {
    await assertFails(setDoc(doc(as('bob'), 'likeCounts', 'm1'), { count: 1, ownerUid: 'alice' }));
  });

  it('1 つのバッチで 2 つのマーカーに付けるのは拒否（印は 1 件だけを指す）', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm2'), storedMarker('alice')));
    const db = as('bob');
    const batch = writeBatch(db);
    for (const id of ['m1', 'm2']) {
      batch.set(doc(db, 'likes', `${id}_bob`), {
        markerId: id, likerUid: 'bob', deleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'likeCounts', id), { count: 1, ownerUid: 'alice' });
    }
    batch.set(doc(db, 'rateLimits', 'bob'), { lastWriteAt: serverTimestamp(), target: 'm1' });
    await assertFails(batch.commit());
  });
});

describe('いいねの閲覧', () => {
  beforeEach(async () => { await likeFirst('bob'); });

  it('件数は未ログインでも読める', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'likeCounts', 'm1')));
  });

  it('いいねは本人と管理者だけ読める。まだ無い自分のいいねも読める', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'likes', 'm1_bob')));
    await assertSucceeds(getDoc(doc(as('root'), 'likes', 'm1_bob')));
    await assertSucceeds(getDoc(doc(as('carol'), 'likes', 'm1_carol')));
    await assertFails(getDoc(doc(as('alice'), 'likes', 'm1_bob')));
    await assertFails(getDoc(doc(guest(), 'likes', 'm1_bob')));
  });

  it('まだ無い他人のいいねは読めない（読めたかどうかで、付けたことがあるかが分かるため）', async () => {
    await assertFails(getDoc(doc(as('alice'), 'likes', 'm1_carol')));
  });

  it('一覧は本人の分に絞ったときだけ。誰が付けたかをマーカーから引けない', async () => {
    await assertSucceeds(getDocs(query(collection(as('bob'), 'likes'), where('likerUid', '==', 'bob'))));
    await assertFails(getDocs(query(collection(as('alice'), 'likes'), where('markerId', '==', 'm1'))));
    await assertSucceeds(getDocs(query(collection(as('root'), 'likes'), where('markerId', '==', 'm1'))));
    await assertFails(getDocs(collection(as('bob'), 'likes')));
  });
});
