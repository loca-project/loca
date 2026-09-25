/**
 * 管理者・ブラックリスト・レートリミット・既定の拒否（ADR 0010「要件ごとの実装可否」の ○ の行）。
 * 5.x 管理者モード / 5.x ブラックリスト（書き込みの拒否まで）/ 1.3 利用者単位のレートリミット
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { newMarker, seed, resetFirestore, setupEnv, stampedWrite, storedMarker } from './helpers.mjs';

let env;
before(async () => { env = await setupEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
    await setDoc(doc(db, 'blacklist', 'mallory'), { reason: 'スパム' });
    await setDoc(doc(db, 'markers', 'm1'), storedMarker('alice'));
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

describe('5.x 管理者モード', () => {
  it('管理者は他人のマーカーを論理削除できる（印なし）', async () => {
    const ref = doc(as('root'), 'markers', 'm1');
    await assertSucceeds(updateDoc(ref, { deleted: true, updatedAt: serverTimestamp() }));
  });

  it('管理者は物理削除できる', async () => {
    await assertSucceeds(deleteDoc(doc(as('root'), 'markers', 'm1')));
  });

  it('管理者は管理者を追加できる', async () => {
    await assertSucceeds(setDoc(doc(as('root'), 'admins', 'alice'), { note: '追加', addedAt: serverTimestamp() }));
  });

  it('一般利用者は自分を管理者にできない', async () => {
    await assertFails(setDoc(doc(as('alice'), 'admins', 'alice'), { note: '自称' }));
  });

  it('本人は自分が管理者かどうかを読める', async () => {
    await assertSucceeds(getDoc(doc(as('root'), 'admins', 'root')));
    await assertSucceeds(getDoc(doc(as('alice'), 'admins', 'alice')));
  });

  it('一般利用者は他人の管理者の行を読めない', async () => {
    await assertFails(getDoc(doc(as('alice'), 'admins', 'root')));
  });
});

describe('5.x ブラックリスト', () => {
  it('ブラックリストの利用者は作成できない', async () => {
    await assertFails(stampedWrite(as('mallory'), 'mallory', 'm2', newMarker('mallory')));
  });

  it('ブラックリストの利用者は自分の行を読める（ログイン直後の判定用）', async () => {
    await assertSucceeds(getDoc(doc(as('mallory'), 'blacklist', 'mallory')));
  });

  it('他人はブラックリストの行を読めない', async () => {
    await assertFails(getDoc(doc(as('alice'), 'blacklist', 'mallory')));
  });

  it('一般利用者は自分をブラックリストから外せない', async () => {
    await assertFails(deleteDoc(doc(as('mallory'), 'blacklist', 'mallory')));
  });

  it('管理者はブラックリストに追加できる', async () => {
    await assertSucceeds(setDoc(doc(as('root'), 'blacklist', 'bob'), { reason: '通報多数' }));
  });

  it('ブラックリストに入った管理者も書き込めない', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'root'), { reason: '乗っ取り' }));
    await assertFails(deleteDoc(doc(as('root'), 'markers', 'm1')));
  });
});

describe('1.3 利用者単位のレートリミット', () => {
  it('6 秒以内の 2 回目は拒否', async () => {
    await assertSucceeds(stampedWrite(as('alice'), 'alice', 'm2', newMarker('alice')));
    await assertFails(stampedWrite(as('alice'), 'alice', 'm3', newMarker('alice')));
  });

  it('1 回のバッチで 2 件作るのは拒否', async () => {
    const db = as('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'rateLimits', 'alice'), { lastWriteAt: serverTimestamp(), target: 'm2' });
    batch.set(doc(db, 'markers', 'm2'), newMarker('alice'));
    batch.set(doc(db, 'markers', 'm3'), newMarker('alice'));
    await assertFails(batch.commit());
  });

  it('印を消して間隔をリセットするのは拒否', async () => {
    await assertSucceeds(stampedWrite(as('alice'), 'alice', 'm2', newMarker('alice')));
    await assertFails(deleteDoc(doc(as('alice'), 'rateLimits', 'alice')));
  });

  it('他人の印は読めない', async () => {
    await assertFails(getDoc(doc(as('bob'), 'rateLimits', 'alice')));
  });
});

describe('定期処理の記録（jobs。ADR 0017）', () => {
  beforeEach(async () => {
    await seed(env, (db) => setDoc(doc(db, 'jobs', 'youtube-refresh'), { checked: 3 }));
  });

  it('管理者は読める', async () => {
    await assertSucceeds(getDoc(doc(as('root'), 'jobs', 'youtube-refresh')));
  });

  it('管理者以外は読めない', async () => {
    await assertFails(getDoc(doc(as('alice'), 'jobs', 'youtube-refresh')));
  });

  it('管理者でも書けない（Actions だけが IAM の経路で書く）', async () => {
    await assertFails(setDoc(doc(as('root'), 'jobs', 'youtube-refresh'), { checked: 0 }));
  });
});

describe('ルールに無いコレクションは拒否', () => {
  it('未定義のコレクションは読み書きとも拒否', async () => {
    await assertFails(getDoc(doc(as('root'), 'unknownCollection', 'x1')));
    await assertFails(setDoc(doc(as('root'), 'unknownCollection', 'x1'), { a: 1 }));
  });
});

describe('管理者への昇格と一般への戻し（T75）', () => {
  const grant = (by, uid, over = {}) => setDoc(doc(as(by), 'admins', uid), { note: '管理者画面から', addedAt: serverTimestamp(), ...over });

  it('管理者は、プロフィール登録済みの一般ユーザーを管理者にでき、一般に戻せる', async () => {
    await assertSucceeds(grant('root', 'alice'));
    await assertSucceeds(deleteDoc(doc(as('root'), 'admins', 'alice')));
  });

  it('一般ユーザーは昇格も降格もできない', async () => {
    await assertFails(grant('alice', 'bob'));
    await assertFails(deleteDoc(doc(as('alice'), 'admins', 'root')));
  });

  it('自分自身は一般に戻せない。後から管理者になった人は、先の管理者を戻せない（先任順）', async () => {
    await assertFails(deleteDoc(doc(as('root'), 'admins', 'root')));
    await grant('root', 'alice');
    await assertFails(deleteDoc(doc(as('alice'), 'admins', 'root')));
    await assertSucceeds(deleteDoc(doc(as('root'), 'admins', 'alice')));
  });

  it('同じ時刻に管理者になった人どうしは、互いに戻せない（0 人にならない）', async () => {
    const t = new Date('2026-01-01T00:00:00Z');
    await seed(env, async (db) => {
      await setDoc(doc(db, 'admins', 'alice'), { note: 'x', addedAt: t });
      await setDoc(doc(db, 'admins', 'bob'), { note: 'x', addedAt: t });
    });
    await assertFails(deleteDoc(doc(as('alice'), 'admins', 'bob')));
    await assertFails(deleteDoc(doc(as('bob'), 'admins', 'alice')));
  });

  it('ブラックリストの管理者は昇格も戻しもできない。メモは 200 字まで。既に管理者の人への書き込みは拒否', async () => {
    await grant('root', 'alice');
    await seed(env, async (db) => {
      await setDoc(doc(db, 'admins', 'mallory'), { note: 'x', addedAt: new Date('2025-01-01T00:00:00Z') });
      await setDoc(doc(db, 'blacklist', 'mallory'), { reason: '試験' });
    });
    await assertFails(grant('mallory', 'carol'));
    await assertFails(deleteDoc(doc(as('mallory'), 'admins', 'alice')));
    await assertFails(grant('root', 'carol', { note: 'a'.repeat(201) }));
    await assertFails(grant('root', 'alice'));
  });

  it('1 回の書き込みで「管理者にする」と「ブラックリストに入れる」を同時にはできない。「戻す」と「入れる」は一緒にできる', async () => {
    const db = as('root');
    const both = writeBatch(db);
    both.set(doc(db, 'admins', 'carol'), { note: 'x', addedAt: serverTimestamp() });
    both.set(doc(db, 'blacklist', 'carol'), { reason: '試験' });
    await assertFails(both.commit());
    await grant('root', 'alice');
    const swap = writeBatch(db);
    swap.delete(doc(db, 'admins', 'alice'));
    swap.set(doc(db, 'blacklist', 'alice'), { reason: '試験' });
    await assertSucceeds(swap.commit());
  });

  it('プロフィール未登録・ブラックリストの人は昇格できない。形が違う・時刻が端末のものは拒否', async () => {
    await assertFails(grant('root', 'dave'));
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'bob'), { reason: '試験' }));
    await assertFails(grant('root', 'bob'));
    await assertFails(grant('root', 'carol', { extra: 1 }));
    await assertFails(grant('root', 'carol', { addedAt: new Date(0) }));
    await assertFails(grant('root', 'carol', { note: '' }));
  });

  it('付けたあとの書き換えはできない', async () => {
    await grant('root', 'alice');
    await assertFails(updateDoc(doc(as('root'), 'admins', 'alice'), { note: '書き換え' }));
  });

  it('管理者はブラックリストに入れられない（先に一般に戻す）。一般ユーザーは入れられる', async () => {
    await grant('root', 'alice');
    await assertFails(setDoc(doc(as('root'), 'blacklist', 'alice'), { reason: '試験' }));
    await assertFails(setDoc(doc(as('root'), 'blacklist', 'root'), { reason: '試験' }));
    await assertSucceeds(setDoc(doc(as('root'), 'blacklist', 'bob'), { reason: '試験' }));
  });
});
