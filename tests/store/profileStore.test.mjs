/**
 * プロフィールのアダプタ（src/adapters/firebase/profileStore.ts）を、本番と同じルールのエミュレータに当てる。
 * dave は未登録（resetFirestore が置く REGISTERED に含めない）。
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { resetFirestore, setupEnv } from '../rules/helpers.mjs';

let env;
let vite;
let createProfileStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ createProfileStore } = await vite.ssrLoadModule('/src/adapters/firebase/profileStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => { await resetFirestore(env); });

const user = (uid) => ({ uid, displayName: `${uid} Google 名`, email: `${uid}@example.com`, photoUrl: null });
const storeFor = (uid) => createProfileStore(env.authenticatedContext(uid).firestore(), () => user(uid));

/** 購読して、条件に合う最初の値を返す。 */
function next(store, uid, until) {
  return new Promise((resolve, reject) => {
    const stop = store.watch(uid, (p) => {
      if (!until(p)) return;
      stop();
      resolve(p);
    }, reject);
  });
}

async function read(uid) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'users', uid))).data();
  });
  return data;
}

describe('プロフィールの登録と編集', () => {
  it('未登録なら null が届く', async () => {
    assert.equal(await next(storeFor('dave'), 'dave', () => true), null);
  });

  it('登録すると、ニックネームと同意の版だけが保存される（メール・Google の名前は保存しない）', async () => {
    await storeFor('dave').register('  だいち  ');
    const saved = await read('dave');
    assert.deepEqual(Object.keys(saved).sort(), ['agreedAt', 'consentVersion', 'createdAt', 'nickname', 'updatedAt']);
    assert.equal(saved.nickname, 'だいち');
    assert.equal(saved.consentVersion, 1);
  });

  it('登録後の購読には、ニックネームと同意日時が届く', async () => {
    const store = storeFor('dave');
    await store.register('だいち');
    const p = await next(store, 'dave', (v) => v !== null);
    assert.equal(p.nickname, 'だいち');
    assert.ok(p.agreedAt > 0);
  });

  it('ニックネームを変えられる', async () => {
    await storeFor('alice').rename('ありす');
    assert.equal((await read('alice')).nickname, 'ありす');
  });

  it('21 字のニックネームは送る前に止める', async () => {
    await assert.rejects(storeFor('dave').register('あ'.repeat(21)), /1〜20 字/);
  });

  it('登録済みの人が登録し直す（同意日時の上書き）は拒否', async () => {
    await assert.rejects(storeFor('alice').register('ありす'), /保存できませんでした/);
  });

  it('他人のプロフィールは購読できない', async () => {
    await assert.rejects(next(storeFor('bob'), 'alice', () => true), /読み込めません/);
  });
});
