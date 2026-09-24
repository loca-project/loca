/**
 * Firestore アダプタ（src/adapters/firebase/markerStore.ts）を、本番と同じルールのエミュレータに当てる。
 * ルール単体のテスト（tests/rules/）と違い、アプリが実際に組み立てる書き込みが通るかを確かめる。
 *
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。
 * 実行: npm run test:rules（エミュレータの中で tests/rules と一緒に走る）
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { doc, getDoc } from 'firebase/firestore';
import { createServer } from 'vite';
import { expireStamp, setupEnv } from '../rules/helpers.mjs';

let env;
let vite;
let createMarkerStore;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ createMarkerStore } = await vite.ssrLoadModule('/src/adapters/firebase/markerStore.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => { await env.clearFirestore(); });

const user = (uid) => ({ uid, displayName: `${uid} さん`, email: null, photoUrl: null });
const storeFor = (uid) => createMarkerStore(env.authenticatedContext(uid).firestore(), () => user(uid));

const content = {
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  lat: 35.681,
  lng: 139.767,
  tags: { action: '行きたい', atmosphere: '静か', emotion: '癒し' },
  equipment: { manufacturer: '', series: '', model: '' },
  title: 'テスト動画',
  city: undefined, // 値の無い項目は保存時に落とされること
};

async function read(id) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'markers', id))).data();
  });
  return data;
}

describe('アダプタでの作成・更新・論理削除', () => {
  it('作成すると本人の uid と仮の投稿者名（本名ではない）、未削除で保存される', async () => {
    const id = await storeFor('alice').create(content);
    const saved = await read(id);
    assert.equal(saved.ownerUid, 'alice');
    assert.equal(saved.createdBy, 'user-alice');
    assert.equal(saved.deleted, false);
    assert.equal('city' in saved, false);
  });

  it('本人は更新できる（6 秒あけたあと）', async () => {
    const store = storeFor('alice');
    const id = await store.create(content);
    await expireStamp(env, 'alice');
    await store.update(id, { title: '書き換えた' });
    assert.equal((await read(id)).title, '書き換えた');
  });

  it('本人は論理削除できる', async () => {
    const store = storeFor('alice');
    const id = await store.create(content);
    await expireStamp(env, 'alice');
    await store.softDelete(id);
    assert.equal((await read(id)).deleted, true);
  });
});

describe('1.4 差分の購読（別のタブの変更が届く）', () => {
  /** 条件を満たす通知が来るまで待つ。来なければ 5 秒で失敗させる。 */
  function waitFor(store, sinceMs, predicate) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error('5 秒以内に通知が来ない')); }, 5000);
      const stop = store.subscribeChanges(sinceMs, (rows) => {
        const hit = rows.find(predicate);
        if (!hit) return;
        clearTimeout(timer);
        stop();
        resolve(hit);
      }, (e) => { clearTimeout(timer); stop(); reject(e); });
    });
  }

  it('未ログインの閲覧者に、他人の新規登録が届く', async () => {
    const viewer = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    const arrived = waitFor(viewer, Date.now() - 60_000, (m) => m.title === 'テスト動画');
    const id = await storeFor('alice').create(content);
    const got = await arrived;
    assert.equal(got.id, id);
    assert.equal(got.deleted, false);
    assert.ok(got.updatedAt > 0, 'updatedAt が epoch ms になっている');
  });

  it('論理削除は deleted: true の行として届く', async () => {
    const store = storeFor('alice');
    const id = await store.create(content);
    await expireStamp(env, 'alice');
    const viewer = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    const arrived = waitFor(viewer, Date.now() - 60_000, (m) => m.id === id && m.deleted);
    await store.softDelete(id);
    assert.equal((await arrived).deleted, true);
  });

  it('markers.json の生成時刻より前の行は届かない', async () => {
    await storeFor('alice').create(content);
    const viewer = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    const future = Date.now() + 3_600_000;
    await assert.rejects(waitFor(viewer, future, () => true), /5 秒以内/);
  });
});

describe('拒否されたときのエラー', () => {
  it('6 秒以内の連続保存は UpstreamError（permission-denied）', async () => {
    const store = storeFor('alice');
    await store.create(content);
    await assert.rejects(store.create(content), { name: 'UpstreamError', message: /6 秒/ });
  });

  it('他人のマーカーは更新できない', async () => {
    const id = await storeFor('alice').create(content);
    await assert.rejects(storeFor('bob').update(id, { title: '乗っ取り' }), { name: 'UpstreamError' });
  });

  it('未ログインでは通信する前に UpstreamError', async () => {
    const guest = createMarkerStore(env.unauthenticatedContext().firestore(), () => null);
    await assert.rejects(guest.create(content), { name: 'UpstreamError', message: /ログイン/ });
  });
});
