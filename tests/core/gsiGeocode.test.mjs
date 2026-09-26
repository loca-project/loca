/**
 * 国土地理院のアダプタが、応答しない API で止まらないこと（src/adapters/geocode/gsi.ts）。
 * fetch は差し替える（本物の API は呼ばない）。実行: npm run test:core（npm run check に含む）
 */
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let gsi;
const realFetch = globalThis.fetch;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  gsi = await vite.ssrLoadModule('/src/adapters/geocode/gsi.ts');
});
after(async () => { await vite.close(); });
afterEach(() => { globalThis.fetch = realFetch; });

/** 接続だけ受けて応答しない API（中断の合図が来たら中断のエラーで終わる） */
const hangingFetch = (_url, { signal }) => new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason));
});

describe('getJson', () => {
  it('応答が無ければ上限の時間で GsiTimeoutError になる（止まったままにならない）', async () => {
    globalThis.fetch = hangingFetch;
    const started = Date.now();
    await assert.rejects(gsi.getJson('https://example.invalid/', 50), (e) => e instanceof gsi.GsiTimeoutError);
    assert.ok(Date.now() - started < 2000, `${Date.now() - started} ms かかった`);
  });

  it('応答があれば JSON を返す', async () => {
    globalThis.fetch = async () => new Response('[{"a":1}]', { status: 200 });
    assert.deepEqual(await gsi.getJson('https://example.invalid/', 50), [{ a: 1 }]);
  });
});

describe('forward', () => {
  it('住所検索が応答しないときは「見つからない」ではなく、応答しないと伝える', async () => {
    globalThis.fetch = async () => { throw new DOMException('timed out', 'TimeoutError'); };
    await assert.rejects(gsi.gsiGeocodeAdapter.forward('京都駅'), /応答しません/);
  });

  it('候補が無いときは「見つからない」と伝える', async () => {
    globalThis.fetch = async () => new Response('[]', { status: 200 });
    await assert.rejects(gsi.gsiGeocodeAdapter.forward('存在しない地名'), /見つかりませんでした/);
  });
});
