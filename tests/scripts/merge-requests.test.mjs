/**
 * requests.json の作り直し（scripts/lib/merge-requests.mjs）。通信しない。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRequests } from '../../scripts/lib/merge-requests.mjs';

const fsRow = (id, heat, lat = 35.0, createdAt = 1000) => ({
  id, lat, lng: 135.0, heat, equipment: { category: '', manufacturer: '', series: '', model: '' }, ownerUid: 'u1', createdAt,
});

describe('mergeRequests', () => {
  it('近い Firestore のリクエストは 1 地点にまとまり、合計と件数が出る', () => {
    const spots = mergeRequests([fsRow('a', 2), fsRow('b', 3, 35.0001)], []);
    assert.equal(spots.length, 1);
    assert.equal(spots[0].totalHeat, 5);
    assert.equal(spots[0].requestCount, 2);
    assert.equal(spots[0].id, 'rq_a');
    assert.equal(spots[0].entries[0].ownerUid, 'u1', '本人の取り下げのため ownerUid を持つ');
  });

  it('季節・時間帯・撮り方はキーのまま入り、無い項目は持たない', () => {
    const rows = [{ ...fsRow('a', 2), season: 'autumn', style: 'aerial' }];
    const [entry] = mergeRequests(rows, [])[0].entries;
    assert.equal(entry.season, 'autumn');
    assert.equal(entry.style, 'aerial');
    assert.equal('timeOfDay' in entry, false);
    assert.equal('atmosphere' in entry, false);
  });

  it('前回入れた Firestore の行は入れ直す（二重に数えない・消えた行は落ちる）', () => {
    const first = mergeRequests([fsRow('a', 2), fsRow('b', 1, 36.0)], []);
    const again = mergeRequests([fsRow('a', 2)], first);
    assert.equal(again.length, 1);
    assert.equal(again[0].totalHeat, 2);
  });

  it('作り直した地点は、前回の同じ ID の地点から地名を引き継ぐ', () => {
    const first = mergeRequests([fsRow('a', 1)], []);
    first[0].prefecture = '大阪府';
    first[0].city = '大阪市';
    const again = mergeRequests([fsRow('a', 1)], first);
    assert.equal(again[0].city, '大阪市');
  });

  it('取り下げ済み（withdrawn: true）は含めない', () => {
    const spots = mergeRequests([fsRow('a', 2), { ...fsRow('b', 3), withdrawn: true }], []);
    assert.equal(spots[0].totalHeat, 2);
    assert.equal(spots[0].requestCount, 1);
  });

  it('熱量の多い順に並ぶ', () => {
    const spots = mergeRequests([fsRow('a', 1), fsRow('b', 5, 36.0)], []);
    assert.deepEqual(spots.map((s) => s.totalHeat), [5, 1]);
  });
});
