/**
 * 管理者モードのアダプタ（src/adapters/firebase/adminStore.ts。T27）を、本番と同じルールのエミュレータに当てる。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
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
