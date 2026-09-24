/**
 * 通報のアダプタ（src/adapters/firebase/reportStore.ts）。本番と同じルールのエミュレータに当てる。
 * 実行: npm run test:rules
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { doc, setDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { seed, setupEnv, storedMarker } from '../rules/helpers.mjs';

let env;
let vite;
let createReportStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ createReportStore } = await vite.ssrLoadModule('/src/adapters/firebase/reportStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, (db) => setDoc(doc(db, 'markers', 'm1'), storedMarker('alice')));
});

const storeFor = (uid) => createReportStore(env.authenticatedContext(uid).firestore(), () => ({ uid, displayName: uid, email: null, photoUrl: null }));

describe('通報のアダプタ', () => {
  it('1 回目は created、同じマーカーの 2 回目は already（エラーにしない）', async () => {
    const store = storeFor('bob');
    assert.equal(await store.submit({ markerId: 'm1', reasons: ['copyright'], detail: '' }), 'created');
    assert.equal(await store.submit({ markerId: 'm1', reasons: ['illegal'], detail: '再送' }), 'already');
  });

  it('未ログインは UpstreamError', async () => {
    const guest = createReportStore(env.unauthenticatedContext().firestore(), () => null);
    await assert.rejects(guest.submit({ markerId: 'm1', reasons: ['copyright'], detail: '' }), { name: 'UpstreamError' });
  });

  it('存在しないマーカーは UpstreamError', async () => {
    await assert.rejects(storeFor('bob').submit({ markerId: 'm9', reasons: ['copyright'], detail: '' }), { name: 'UpstreamError' });
  });
});