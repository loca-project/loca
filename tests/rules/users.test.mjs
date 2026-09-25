/**
 * users コレクション（プロフィール）のルールと、未登録の利用者が書き込めないこと（要件 1.1・2.5・2.6・ADR 0019）。
 * dave は未登録（resetFirestore が置く REGISTERED に含めない）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { newMarker, registerWrite, resetFirestore, seed, setupEnv, stampedWrite, storedMarker } from './helpers.mjs';

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

const reg = (uid, overrides = {}, db = as(uid)) => registerWrite(db, uid, profile(overrides));

/** アプリと同じ手順で名前を変える: プロフィール・新しい索引・古い索引の手放しを同じバッチで書く。 */
function renameWrite(uid, from, to, { release = true } = {}) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { nickname: to, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'nicknames', to.toLowerCase()), { uid });
  if (release) batch.delete(doc(db, 'nicknames', from.toLowerCase()));
  return batch.commit();
}

describe('登録（作成）', () => {
  it('本人が同意の版 1 とサーバー時刻で、名前の索引と一緒に登録できる', async () => {
    await assertSucceeds(reg('dave'));
  });

  it('他人の uid では登録できない', async () => {
    await assertFails(reg('erin', {}, as('dave')));
  });

  it('未ログインは登録できない', async () => {
    await assertFails(reg('dave', {}, guest()));
  });

  it('同意日時が端末の時計・同意の版が 1 以外なら拒否', async () => {
    const past = Timestamp.fromMillis(Date.parse('2026-01-01T00:00:00Z'));
    await assertFails(reg('dave', { agreedAt: past }));
    await assertFails(reg('dave', { consentVersion: 2 }));
  });

  it('メールなど決めていない項目は保存させない', async () => {
    await assertFails(reg('dave', { email: 'dave@example.com' }));
  });

  it('ニックネームは 1〜20 字・改行なし・前後の空白なし・「/」なし', async () => {
    await assertSucceeds(reg('dave', { nickname: 'あ'.repeat(20) }));
    for (const nickname of ['', 'あ'.repeat(21), 'だい\nち', ' だいち', 'だい/ち', '__x__']) {
      await assertFails(setDoc(doc(as('erin'), 'users', 'erin'), profile({ nickname })));
    }
  });

  it('ブラックリストの利用者は登録できない', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'dave'), { reason: 'スパム' }));
    await assertFails(reg('dave'));
  });
});

describe('ニックネームの重複の禁止（ADR 0019 決定 9）', () => {
  it('ほかの人が使っている名前では登録できない', async () => {
    await assertFails(reg('dave', { nickname: 'alice さん' }));
  });

  it('大文字と小文字だけが違う名前も同じ名前とみなす', async () => {
    await reg('dave', { nickname: 'Daichi' });
    await assertFails(reg('erin', { nickname: 'DAICHI' }));
  });

  it('索引を作らない登録は拒否', async () => {
    await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), profile()));
  });

  it('プロフィールの無い人は索引だけを先取りできない', async () => {
    await assertFails(setDoc(doc(as('dave'), 'nicknames', 'だいち'), { uid: 'dave' }));
  });

  it('ほかの人が使っている名前には変えられない', async () => {
    await assertFails(renameWrite('alice', 'alice さん', 'bob さん'));
  });

  it('変えたら古い名前は手放され、ほかの人が使えるようになる', async () => {
    await assertSucceeds(renameWrite('alice', 'alice さん', 'ありす'));
    await assertSucceeds(reg('dave', { nickname: 'alice さん' }));
  });

  it('古い名前の索引を残したままの変更は拒否（買い占めさせない）', async () => {
    await assertFails(renameWrite('alice', 'alice さん', 'ありす', { release: false }));
  });

  it('他人の索引は消せない・書き換えられない', async () => {
    await assertFails(deleteDoc(doc(as('bob'), 'nicknames', 'alice さん')));
    await assertFails(setDoc(doc(as('bob'), 'nicknames', 'alice さん'), { uid: 'bob' }));
  });

  it('いまの名前の索引は本人でも消せない', async () => {
    await assertFails(deleteDoc(doc(as('alice'), 'nicknames', 'alice さん')));
  });

  it('ログイン済みなら使われているかを 1 件ずつ確かめられる（一覧は不可）', async () => {
    await assertSucceeds(getDoc(doc(as('dave'), 'nicknames', 'alice さん')));
    await assertFails(getDoc(doc(guest(), 'nicknames', 'alice さん')));
    await assertFails(getDocs(collection(as('dave'), 'nicknames')));
  });
});

describe('閲覧・編集・削除', () => {
  it('読めるのは本人と管理者だけ', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users', 'alice')));
    await assertSucceeds(getDoc(doc(as('root'), 'users', 'alice')));
    await assertFails(getDoc(doc(as('bob'), 'users', 'alice')));
    await assertFails(getDoc(doc(guest(), 'users', 'alice')));
  });

  it('大文字小文字だけの変更は、索引を持ったまま変えられる', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users', 'alice'), { nickname: 'ALICE さん', updatedAt: serverTimestamp() }));
  });

  it('前の登録・変更から 60 秒以内の変更は拒否（付け替えの繰り返しで書き込みを増やさせない）', async () => {
    await reg('dave');
    await assertFails(renameWrite('dave', 'だいち', 'だいち2'));
  });

  it('同意の記録と登録日は変えられない', async () => {
    const ref = doc(as('alice'), 'users', 'alice');
    await assertFails(updateDoc(ref, { agreedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });

  it('他人のニックネームは変えられない', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'users', 'alice'), { nickname: 'x', updatedAt: serverTimestamp() }));
  });

  it('本人（アカウント削除。ADR 0021）と管理者は消せる。他人は消せない', async () => {
    await assertFails(deleteDoc(doc(as('bob'), 'users', 'alice')));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'users', 'alice')));
    await assertSucceeds(deleteDoc(doc(as('root'), 'users', 'bob')));
  });
});

describe('投稿者名をいまのニックネームにそろえる（ADR 0019 決定 7）', () => {
  const align = (uid, createdBy, extra = {}) =>
    updateDoc(doc(as(uid), 'markers', 'm1'), { createdBy, updatedAt: serverTimestamp(), ...extra });

  beforeEach(async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'markers', 'm1'), storedMarker('alice', { createdBy: '古い名前' }));
      await setDoc(doc(db, 'markers', 'm2'), storedMarker('alice', { createdBy: '古い名前', deleted: true }));
    });
  });

  it('本人は印なしで、いまのニックネームにそろえられる（論理削除済みも）', async () => {
    await assertSucceeds(align('alice', 'alice さん'));
    await assertSucceeds(updateDoc(doc(as('alice'), 'markers', 'm2'), { createdBy: 'alice さん', updatedAt: serverTimestamp() }));
  });

  it('ニックネーム以外の名前（他人の名前）にはできない', async () => {
    await assertFails(align('alice', 'bob さん'));
  });

  it('他人のマーカーの投稿者名は変えられない', async () => {
    await assertFails(align('bob', 'bob さん'));
  });

  it('名前が同じまま updatedAt だけを進める「空の更新」は拒否（印なしで何度も書かせない）', async () => {
    await seed(env, (db) => setDoc(doc(db, 'markers', 'm3'), storedMarker('alice')));
    await assertFails(updateDoc(doc(as('alice'), 'markers', 'm3'), { createdBy: 'alice さん', updatedAt: serverTimestamp() }));
  });

  it('そろえるついでにほかの項目は変えられない', async () => {
    await assertFails(align('alice', 'alice さん', { title: '書き換え' }));
  });

  it('ニックネームの変更と同じバッチでそろえられる', async () => {
    const db = as('alice');
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', 'alice'), { nickname: 'ありす', updatedAt: serverTimestamp() });
    batch.set(doc(db, 'nicknames', 'ありす'), { uid: 'alice' });
    batch.delete(doc(db, 'nicknames', 'alice さん'));
    batch.update(doc(db, 'markers', 'm1'), { createdBy: 'ありす', updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
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

describe('公開プロフィールの YouTube チャンネル（T55・ADR 0029）', () => {
  const UC = `UC${'a'.repeat(22)}`;
  const pub = (db, uid) => doc(db, 'publicProfiles', uid);

  it('本人はチャンネル ID か @ハンドルを登録・変更でき、消すこともできる。誰でも読める', async () => {
    await assertSucceeds(setDoc(pub(as('alice'), 'alice'), { channel: UC }));
    await assertSucceeds(setDoc(pub(as('alice'), 'alice'), { channel: '@ロカ公式' }));
    await assertSucceeds(getDoc(pub(guest(), 'alice')));
    await assertSucceeds(deleteDoc(pub(as('alice'), 'alice')));
  });

  it('決めた形でないもの（URL のまま・短い ID・空白入り・数値・空）と、余計な項目は拒否', async () => {
    const ref = pub(as('alice'), 'alice');
    await assertFails(setDoc(ref, { channel: `https://www.youtube.com/channel/${UC}` }));
    await assertFails(setDoc(ref, { channel: 'UCabc' }));
    await assertFails(setDoc(ref, { channel: '@ロカ 公式' }));
    await assertFails(setDoc(ref, { channel: 123 }));
    await assertFails(setDoc(ref, {}));
    await assertFails(setDoc(ref, { channel: UC, note: 'x' }));
  });

  it('他人・未ログイン・プロフィール未登録・ブラックリストの本人は書けない。管理者は消せる', async () => {
    await assertFails(setDoc(pub(as('bob'), 'alice'), { channel: UC }));
    await assertFails(setDoc(pub(guest(), 'alice'), { channel: UC }));
    await assertFails(setDoc(pub(as('dave'), 'dave'), { channel: UC }));
    await seed(env, async (db) => {
      await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
      await setDoc(doc(db, 'publicProfiles', 'alice'), { channel: UC });
      await setDoc(doc(db, 'blacklist', 'bob'), { blocked: true, reason: '試験' });
    });
    await assertFails(setDoc(pub(as('bob'), 'bob'), { channel: UC }));
    await assertSucceeds(deleteDoc(pub(as('root'), 'alice')));
  });

  it('プロフィール（users）には channel を書けない', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'users', 'alice'), { channel: UC }));
  });
});
