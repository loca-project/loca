/**
 * markers.json の作り直し（scripts/lib/merge-markers.mjs）。通信しないので、エミュレータなしで走る。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMarkers } from '../../scripts/lib/merge-markers.mjs';

const fs = (id, over = {}) => ({
  id, youtubeUrl: `https://www.youtube.com/watch?v=${id}`, lat: 35, lng: 139,
  tags: { action: 'a', atmosphere: 'b', emotion: 'c' }, equipment: { manufacturer: '', series: '', model: '' },
  ownerUid: 'u1', createdBy: 'user-u1', createdAt: 2000, updatedAt: 2000, deleted: false, ...over,
});
const issue = (id, over = {}) => ({ id, youtubeUrl: 'x', lat: 34, lng: 135, createdBy: 'gh', createdAt: 1000, ...over });

describe('mergeMarkers', () => {
  it('論理削除の行は含めず、deleted 項目も出さない', () => {
    const r = mergeMarkers([fs('a'), fs('b', { deleted: true })], []);
    assert.deepEqual(r.markers.map((m) => m.id), ['a']);
    assert.equal('deleted' in r.markers[0], false);
    assert.equal(r.deleted, 1);
  });

  it('Issue 経由の行（ownerUid なし）は残す', () => {
    const r = mergeMarkers([fs('a')], [issue('i1')]);
    assert.deepEqual(r.markers.map((m) => m.id).sort(), ['a', 'i1']);
    assert.equal(r.fromIssues, 1);
  });

  it('前回 Firestore から来た行が削除されたら消える', () => {
    const r = mergeMarkers([fs('a', { deleted: true })], [fs('a')]);
    assert.equal(r.markers.length, 0);
  });

  it('同じ ID は Firestore を正とする', () => {
    const r = mergeMarkers([fs('i1', { title: '新' })], [issue('i1', { title: '旧' })]);
    assert.equal(r.markers.length, 1);
    assert.equal(r.markers[0].title, '新');
  });

  it('座標が同じなら前回の地名を引き継ぐ。動いていたら引き継がない', () => {
    const prev = [fs('a', { prefecture: '東京都', city: '千代田区' }), fs('b', { prefecture: '東京都', city: '港区' })];
    const r = mergeMarkers([fs('a'), fs('b', { lat: 36 })], prev);
    const byId = Object.fromEntries(r.markers.map((m) => [m.id, m]));
    assert.equal(byId.a.city, '千代田区');
    assert.equal(byId.b.prefecture, undefined);
  });

  it('登録の新しい順に並ぶ', () => {
    const r = mergeMarkers([fs('old', { createdAt: 1 }), fs('new', { createdAt: 9 })], [issue('mid', { createdAt: 5 })]);
    assert.deepEqual(r.markers.map((m) => m.id), ['new', 'mid', 'old']);
  });
});
