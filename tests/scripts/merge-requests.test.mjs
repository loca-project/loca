/**
 * requests.json の作り直し（scripts/lib/merge-requests.mjs）。通信しない。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRequests } from '../../scripts/lib/merge-requests.mjs';

const fsRow = (id, heat, lat = 35.0, createdAt = 1000) => ({
  id, lat, lng: 135.0, heat, equipment: { manufacturer: '', series: '', model: '' }, ownerUid: 'u1', createdAt,
});
const issueSpot = (id, entries) => ({ id, lat: 35.0, lng: 135.0, prefecture: '大阪府', city: '大阪市', entries });

describe('mergeRequests', () => {
  it('近い Firestore のリクエストは 1 地点にまとまり、合計と件数が出る', () => {
    const spots = mergeRequests([fsRow('a', 2), fsRow('b', 3, 35.0001)], []);
    assert.equal(spots.length, 1);
    assert.equal(spots[0].totalHeat, 5);
    assert.equal(spots[0].requestCount, 2);
    assert.equal(spots[0].id, 'rq_a');
  });

  it('Issue 経由の地点に Firestore のリクエストを足す（地名は残る）', () => {
    const spots = mergeRequests([fsRow('a', 1)], [issueSpot('rq_9', [{ id: 're_9', heat: 4, createdAt: 1 }])]);
    assert.equal(spots.length, 1);
    assert.equal(spots[0].totalHeat, 5);
    assert.equal(spots[0].city, '大阪市');
  });

  it('前回入れた Firestore の行は入れ直す（二重に数えない・消えた行は落ちる）', () => {
    const first = mergeRequests([fsRow('a', 2), fsRow('b', 1, 36.0)], []);
    const again = mergeRequests([fsRow('a', 2)], first);
    assert.equal(again.length, 1);
    assert.equal(again[0].totalHeat, 2);
  });

  it('熱量の多い順に並ぶ', () => {
    const spots = mergeRequests([fsRow('a', 1), fsRow('b', 5, 36.0)], []);
    assert.deepEqual(spots.map((s) => s.totalHeat), [5, 1]);
  });
});
