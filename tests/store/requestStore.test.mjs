/**
 * 撮影リクエストのアダプタ（src/adapters/firebase/requestStore.ts）と地点の集計（src/core/logic/requests.ts）。
 * 本番と同じルールのエミュレータに当てる。実行: npm run test:rules
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { setupEnv } from '../rules/helpers.mjs';

let env;
let vite;
let createRequestStore;
let mergeRequestEntries;

before(async () => {
  env = await setupEnv();
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ createRequestStore } = await vite.ssrLoadModule('/src/adapters/firebase/requestStore.ts'));
  ({ mergeRequestEntries } = await vite.ssrLoadModule('/src/core/logic/requests.ts'));
});
after(async () => {
  await env.cleanup();
  await vite.close();
});
beforeEach(async () => { await env.clearFirestore(); });

const user = (uid) => ({ uid, displayName: uid, email: null, photoUrl: null });
const storeFor = (uid) => createRequestStore(env.authenticatedContext(uid).firestore(), () => user(uid));
const content = (heat, lat = 35.0) => ({
  lat, lng: 135.0, heat, season: '春', timeOfDay: '朝', atmosphere: '静か',
  equipment: { manufacturer: '', series: '', model: '' },
});

describe('アダプタでの作成と熱量の上限', () => {
  it('作成すると使った熱量が増える', async () => {
    const store = storeFor('alice');
    assert.equal(await store.heatUsed(), 0);
    const entry = await store.create(content(3));
    assert.equal(entry.heat, 3);
    assert.equal(await store.heatUsed(), 3);
  });

  it('合計 5 を超える分は、通信する前に UpstreamError', async () => {
    const store = storeFor('alice');
    await store.create(content(3));
    await assert.rejects(store.create(content(3)), { name: 'UpstreamError', message: /3 \/ 5/ });
    await store.create(content(2));
    assert.equal(await store.heatUsed(), 5);
  });

  it('未ログインは UpstreamError', async () => {
    const guest = createRequestStore(env.unauthenticatedContext().firestore(), () => null);
    await assert.rejects(guest.create(content(1)), { name: 'UpstreamError', message: /ログイン/ });
  });
});

describe('差分の購読', () => {
  it('未ログインの閲覧者に、他人のリクエストが届く', async () => {
    const viewer = createRequestStore(env.unauthenticatedContext().firestore(), () => null);
    const arrived = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error('5 秒以内に通知が来ない')); }, 5000);
      const stop = viewer.subscribeChanges(Date.now() - 60_000, (rows) => {
        clearTimeout(timer);
        stop();
        resolve(rows);
      }, reject);
    });
    const saved = await storeFor('alice').create(content(2));
    const rows = await arrived;
    assert.equal(rows[0].id, saved.id);
    assert.equal(rows[0].heat, 2);
  });
});

describe('地点ごとの集計（mergeRequestEntries）', () => {
  const entry = (id, heat, lat = 35.0) => ({ ...content(heat, lat), id, createdAt: 1000 });

  it('近いリクエストは同じ地点に足し、遠ければ新しい地点を作る', () => {
    const spots = mergeRequestEntries([], [entry('a', 2), entry('b', 3, 35.0001), entry('c', 1, 36.0)]);
    assert.equal(spots.length, 2);
    const near = spots.find((s) => s.requestCount === 2);
    assert.equal(near.totalHeat, 5);
  });

  it('集計済みの ID は二重に数えない（requests.json と購読の両方に来る）', () => {
    const once = mergeRequestEntries([], [entry('a', 2)]);
    const twice = mergeRequestEntries(once, [entry('a', 2)]);
    assert.equal(twice[0].totalHeat, 2);
    assert.equal(twice[0].requestCount, 1);
  });

  it('entries を持たない既存の地点（Issue 経由）にも足せる', () => {
    const spots = mergeRequestEntries(
      [{ id: 'rq_1', lat: 35.0, lng: 135.0, totalHeat: 4, requestCount: 2, updatedAt: 0 }],
      [entry('a', 1)],
    );
    assert.equal(spots[0].totalHeat, 5);
    assert.equal(spots[0].requestCount, 3);
  });
});
