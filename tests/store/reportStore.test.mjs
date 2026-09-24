/**
 * 通報のアダプタ（src/adapters/firebase/reportStore.ts）。本番と同じルールのエミュレータに当てる。
 * 実行: npm run test:rules
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  it('1 回目は created、同じマーカーの 2 回目は updated（理由と詳細が置き換わる）', async () => {
    const store = storeFor('bob');
    assert.equal(await store.submit({ markerId: 'm1', reasons: ['copyright'], detail: '最初' }), 'created');
    assert.equal(await store.submit({ markerId: 'm1', reasons: ['illegal'], detail: '' }), 'updated');
    let saved;
    await env.withSecurityRulesDisabled(async (ctx) => {
      saved = (await getDoc(doc(ctx.firestore(), 'reports', 'm1_bob'))).data();
    });
    assert.deepEqual(saved.reasons, ['illegal']);
    assert.equal('detail' in saved, false, '空の詳細で更新したら消える');
  });

  it('管理者の集計は、同じ人の再通報を 1 人として数える', async () => {
    await seed(env, (db) => setDoc(doc(db, 'admins', 'root'), { note: '管理者' }));
    await storeFor('bob').submit({ markerId: 'm1', reasons: ['copyright'], detail: '' });
    await storeFor('bob').submit({ markerId: 'm1', reasons: ['copyright', 'illegal'], detail: '' });
    await storeFor('carol').submit({ markerId: 'm1', reasons: ['copyright'], detail: '' });
    const [summary] = await storeFor('root').summaries();
    assert.equal(summary.markerId, 'm1');
    assert.equal(summary.reporters, 2);
    assert.equal(summary.open, 2);
    assert.deepEqual(summary.reasons, { copyright: 2, illegal: 1 });
  });

  it('管理者以外は集計を読めない（UpstreamError）', async () => {
    await assert.rejects(storeFor('bob').summaries(), { name: 'UpstreamError' });
  });

  it('未ログインは UpstreamError', async () => {
    const guest = createReportStore(env.unauthenticatedContext().firestore(), () => null);
    await assert.rejects(guest.submit({ markerId: 'm1', reasons: ['copyright'], detail: '' }), { name: 'UpstreamError' });
  });

  it('存在しないマーカーは UpstreamError', async () => {
    await assert.rejects(storeFor('bob').submit({ markerId: 'm9', reasons: ['copyright'], detail: '' }), { name: 'UpstreamError' });
  });
});