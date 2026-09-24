/**
 * 管理者モードのアダプタ（src/adapters/firebase/adminStore.ts。T27）を、本番と同じルールのエミュレータに当てる。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { resetFirestore, seed, setupEnv } from '../rules/helpers.mjs';

let env;
let vite;
let createAdminStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ createAdminStore } = await vite.ssrLoadModule('/src/adapters/firebase/adminStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => {
  await resetFirestore(env);
  await seed(env, async (db) => {
    await setDoc(doc(db, 'admins', 'root'), { note: '初期管理者' });
    await setDoc(doc(db, 'jobs', 'purge-deleted'), {
      markers: 2, requests: 0, videos: 1, ranAt: Timestamp.fromMillis(Date.parse('2026-09-24T15:00:00Z')),
    });
  });
});

const storeFor = (uid) =>
  createAdminStore(env.authenticatedContext(uid).firestore(), () => ({ uid, displayName: uid, email: null, photoUrl: null }));

describe('管理者モードのアダプタ', () => {
  it('管理者なら true、一般の利用者と未ログインは false', async () => {
    assert.equal(await storeFor('root').amIAdmin(), true);
    assert.equal(await storeFor('alice').amIAdmin(), false);
    const guest = createAdminStore(env.unauthenticatedContext().firestore(), () => null);
    assert.equal(await guest.amIAdmin(), false);
  });

  it('管理者は定期処理の記録を読める（数値の項目と日時）', async () => {
    const jobs = await storeFor('root').jobs();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, 'purge-deleted');
    assert.deepEqual(jobs[0].values, { markers: 2, requests: 0, videos: 1 });
    assert.equal(jobs[0].ranAt, Date.parse('2026-09-24T15:00:00Z'));
  });

  it('一般の利用者は定期処理の記録を読めない（UpstreamError）', async () => {
    await assert.rejects(storeFor('alice').jobs(), { name: 'UpstreamError', message: /管理者だけ/ });
  });
});

describe('ユーザー管理（T59）', () => {
  it('3 区画: 管理者・一般のユーザー（管理者とブラックリストを除く）・ブラックリスト', async () => {
    await seed(env, (db) => setDoc(doc(db, 'blacklist', 'mallory'), { reason: 'スパム' }));
    const lists = await storeFor('root').users();
    assert.deepEqual(lists.admins.map((r) => [r.uid, r.nickname]), [['root', 'root さん']]);
    assert.deepEqual(lists.users.map((r) => r.uid).sort(), ['alice', 'bob', 'carol']);
    assert.deepEqual(lists.blacklist.map((r) => r.uid), ['mallory']);
  });

  it('削除するとプロフィールと名前の索引が消え、その名前をほかの人が使える', async () => {
    await storeFor('root').deleteUser('alice');
    const lists = await storeFor('root').users();
    assert.equal(lists.users.some((r) => r.uid === 'alice'), false);
    await env.withSecurityRulesDisabled(async (ctx) => {
      assert.equal((await getDoc(doc(ctx.firestore(), 'nicknames', 'alice さん'))).exists(), false);
    });
  });

  it('ブラックリストに入れると本人から「入っている」と分かり、外すと戻る', async () => {
    await storeFor('root').blacklist('bob');
    assert.equal(await storeFor('bob').amIBlacklisted(), true);
    assert.equal(await storeFor('alice').amIBlacklisted(), false);
    await storeFor('root').unblacklist('bob');
    assert.equal(await storeFor('bob').amIBlacklisted(), false);
  });

  it('一般の利用者は一覧・削除・ブラックリストの操作ができない（UpstreamError）', async () => {
    const alice = storeFor('alice');
    await assert.rejects(alice.users(), { name: 'UpstreamError', message: /管理者だけ/ });
    await assert.rejects(alice.deleteUser('bob'), { name: 'UpstreamError' });
    await assert.rejects(alice.blacklist('bob'), { name: 'UpstreamError' });
  });
});

describe('マーカー管理（T60）', () => {
  beforeEach(async () => {
    const { storedMarker } = await import('../rules/helpers.mjs');
    await seed(env, async (db) => {
      for (let i = 0; i < 4; i += 1) {
        const m = storedMarker('alice');
        await setDoc(doc(db, 'markers', `a${i}`), m);
        await setDoc(doc(db, 'videos', m.videoId), { markerId: `a${i}`, ownerUid: 'alice', ...(i === 0 ? { blocked: true } : {}) });
      }
    });
  });

  it('管理者は他人のマーカーをまとめて論理削除でき（3 件ずつのバッチ）、禁止の印の無い索引が外れる', async () => {
    assert.equal(await storeFor('root').softDeleteMarkers(['a0', 'a1', 'a2', 'a3']), 4);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 4; i += 1) assert.equal((await getDoc(doc(db, 'markers', `a${i}`))).data().deleted, true);
    });
    assert.equal(await storeFor('root').softDeleteMarkers(['a0']), 0);
  });

  it('一般の利用者は他人のマーカーを消せない（UpstreamError）', async () => {
    await assert.rejects(storeFor('bob').softDeleteMarkers(['a1']), { name: 'UpstreamError' });
  });
});
