/**
 * 人のタブの集計（src/core/logic/people.ts。T88・ADR 0031）。
 * TypeScript と @/ の別名は Vite の ssrLoadModule で解決する。実行: npm run test:core（npm run check に含む）
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite;
let summarizePosters;
let rankPosters;
let searchPosters;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ summarizePosters, rankPosters, searchPosters } = await vite.ssrLoadModule('/src/core/logic/people.ts'));
});
after(async () => { await vite.close(); });

const marker = (id, ownerUid, createdBy, createdAt, viewCount, extra = {}) => ({
  id, ownerUid, createdBy, createdAt, deleted: false, youtube: viewCount === undefined ? undefined : { viewCount }, ...extra,
});

const MARKERS = [
  marker('a1', 'alice', 'アリス', 1, 100),
  marker('a2', 'alice', 'アリス', 5, 50),
  marker('b1', 'bob', 'Bob', 3, 500),
  marker('c1', 'carol', 'キャロル', 9, undefined),
  marker('c2', 'carol', 'キャロル', 2, 10, { deleted: true }),
  marker('x1', undefined, '見本', 4, 999),
];

describe('summarizePosters', () => {
  it('投稿者ごとに本数・再生数・最新の登録日時をまとめ、論理削除と ownerUid の無いものは数えない', () => {
    const rows = summarizePosters(MARKERS).sort((a, b) => a.uid.localeCompare(b.uid));
    assert.deepEqual(rows, [
      { uid: 'alice', name: 'アリス', posts: 2, views: 150, latestAt: 5 },
      { uid: 'bob', name: 'Bob', posts: 1, views: 500, latestAt: 3 },
      { uid: 'carol', name: 'キャロル', posts: 1, views: 0, latestAt: 9 },
    ]);
  });

  it('名前はいちばん新しく登録したマーカーのもの', () => {
    const rows = summarizePosters([marker('1', 'u', '新しい名前', 9, 0), marker('2', 'u', '古い名前', 1, 0)]);
    assert.equal(rows[0].name, '新しい名前');
  });
});

describe('rankPosters', () => {
  const rows = () => summarizePosters(MARKERS);
  it('再生数・本数・新しい順に並べ、limit 人で切る', () => {
    assert.deepEqual(rankPosters(rows(), 'views', 10).map((r) => r.uid), ['bob', 'alice', 'carol']);
    assert.deepEqual(rankPosters(rows(), 'posts', 10).map((r) => r.uid), ['alice', 'bob', 'carol']);
    assert.deepEqual(rankPosters(rows(), 'recent', 2).map((r) => r.uid), ['carol', 'alice']);
  });
});

describe('searchPosters', () => {
  const rows = () => summarizePosters([
    ...MARKERS,
    marker('d1', 'dave', 'ボブ好き', 1, 0),
    marker('e1', 'eve', 'bobby', 1, 0),
    marker('e2', 'eve', 'bobby', 2, 0),
  ]);
  it('大文字と小文字・全角と半角を区別せずに部分一致し、名前が語で始まる人を先に出す', () => {
    assert.deepEqual(searchPosters(rows(), 'ＢＯＢ', 10).map((r) => r.uid), ['eve', 'bob']);
    assert.deepEqual(searchPosters(rows(), 'ボブ', 10).map((r) => r.uid), ['dave']);
    assert.deepEqual(searchPosters(rows(), 'りす', 10).map((r) => r.uid), []);
    assert.deepEqual(searchPosters(rows(), 'リス', 10).map((r) => r.uid), ['alice']);
  });

  it('空の語・空白だけでは何も返さない。limit 人で切る', () => {
    assert.deepEqual(searchPosters(rows(), '  ', 10), []);
    assert.equal(searchPosters(rows(), 'b', 1).length, 1);
  });
});
