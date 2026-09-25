/**
 * YouTube Data API の結果から、更新と論理削除の計画を立てる（scripts/lib/youtube-refresh.mjs。T24）。通信しない。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MISSING_WINDOW_MS, missingTargets, ownerChannelMap, parseDuration, planRefresh } from '../../scripts/lib/youtube-refresh.mjs';

const marker = (id, videoId = `v_${id}`) => ({ id, videoId });
const item = (videoId, over = {}) => ({
  id: videoId,
  snippet: { publishedAt: '2026-01-02T03:04:05Z' },
  statistics: { viewCount: '1234', likeCount: '56' },
  contentDetails: { duration: 'PT4M13S' },
  status: { privacyStatus: 'public', uploadStatus: 'processed' },
  ...over,
});

describe('parseDuration', () => {
  it('ISO 8601 の長さを秒にする', () => {
    assert.equal(parseDuration('PT4M13S'), 253);
    assert.equal(parseDuration('PT1H2M3S'), 3723);
    assert.equal(parseDuration('P1DT1S'), 86401);
    assert.equal(parseDuration('PT0S'), 0);
  });
  it('読めない値は null（0 と区別する）', () => {
    assert.equal(parseDuration(''), null);
    assert.equal(parseDuration('4:13'), null);
  });
});

describe('planRefresh', () => {
  it('公開中の動画は再生数・投稿日・長さで更新する（数値は数にする）', () => {
    const plan = planRefresh([marker('a')], [item('v_a')]);
    assert.deepEqual(plan.updates, [
      { id: 'a', youtube: { viewCount: 1234, likeCount: 56, publishedAt: '2026-01-02T03:04:05Z', durationSec: 253 } },
    ]);
    assert.deepEqual(plan.gone, []);
  });

  it('API が返さない動画と非公開の動画は、消えたものとして論理削除の対象にする', () => {
    const plan = planRefresh([marker('a'), marker('b'), marker('c')], [item('v_a'), item('v_c', { status: { privacyStatus: 'private' } })]);
    assert.deepEqual(plan.gone.sort(), ['b', 'c']);
    assert.deepEqual(plan.updates.map((u) => u.id), ['a']);
  });

  it('限定公開は再生できるので残す', () => {
    const plan = planRefresh([marker('a')], [item('v_a', { status: { privacyStatus: 'unlisted', uploadStatus: 'processed' } })]);
    assert.deepEqual(plan.gone, []);
  });

  it('再生数を隠している動画は、再生数だけ持たない', () => {
    const plan = planRefresh([marker('a')], [item('v_a', { statistics: {} })]);
    assert.equal('viewCount' in plan.updates[0].youtube, false);
    assert.equal(plan.updates[0].youtube.durationSec, 253);
  });

  it('10 件以上あって 2 割を超えて消えたと出たら、削除を止める（API の異常で消しすぎないため）', () => {
    const markers = Array.from({ length: 10 }, (_, i) => marker(String(i)));
    const alive = markers.slice(0, 7).map((m) => item(m.videoId));
    const plan = planRefresh(markers, alive);
    assert.deepEqual(plan.gone, []);
    assert.equal(plan.blockedGone, 3);
  });

  it('10 件未満なら割合では止めない', () => {
    const plan = planRefresh([marker('a'), marker('b')], [item('v_a')]);
    assert.deepEqual(plan.gone, ['b']);
    assert.equal(plan.blockedGone, 0);
  });
});

describe('missingTargets（毎時の更新。T57）', () => {
  it('YouTube の情報が無く、論理削除されておらず、動画 ID があるものだけ', () => {
    const rows = [
      { id: 'new', videoId: 'v1' },
      { id: 'done', videoId: 'v2', youtube: { viewCount: 1 } },
      { id: 'gone', videoId: 'v3', deleted: true },
      { id: 'broken' },
    ];
    assert.deepEqual(missingTargets(rows).map((m) => m.id), ['new']);
  });

  it('読む範囲は 1 日より長い（毎晩の全件更新が 1 回失敗しても拾える）', () => {
    assert.ok(MISSING_WINDOW_MS > 24 * 60 * 60 * 1000);
  });
});

describe('本人のチャンネルの照合（T55・ADR 0029）', () => {
  const UC_A = `UC${'a'.repeat(22)}`;
  const UC_B = `UC${'b'.repeat(22)}`;
  const withChannel = (videoId, channelId) => item(videoId, { snippet: { publishedAt: '2026-01-02T03:04:05Z', channelId } });

  it('動画のチャンネル ID を持ち、投稿者の自己申告と同じなら ownChannel を付ける（違えば付けない）', () => {
    const markers = [{ ...marker('a'), ownerUid: 'alice' }, { ...marker('b'), ownerUid: 'alice' }, { ...marker('c'), ownerUid: 'bob' }];
    const items = [withChannel('v_a', UC_A), withChannel('v_b', UC_B), withChannel('v_c', UC_A)];
    const plan = planRefresh(markers, items, new Map([['alice', UC_A]]));
    const byId = Object.fromEntries(plan.updates.map((u) => [u.id, u.youtube]));
    assert.equal(byId.a.channelId, UC_A);
    assert.equal(byId.a.ownChannel, true);
    assert.equal(byId.b.ownChannel, undefined);
    assert.equal(byId.c.ownChannel, undefined);
  });

  it('users の channel を uid → チャンネル ID にする（ハンドルは直せたものだけ・大文字小文字は区別しない）', () => {
    const users = [
      { id: 'alice', channel: UC_A },
      { id: 'bob', channel: '@Loca_Bob' },
      { id: 'carol', channel: '@unknown_handle' },
      { id: 'dave', channel: 'https://example.com' },
      { id: 'erin', channel: '@ロカ公式' },
    ];
    const map = ownerChannelMap(users, new Map([['@loca_bob', UC_B], ['@ロカ公式', UC_A]]));
    assert.deepEqual([...map.entries()], [['alice', UC_A], ['bob', UC_B], ['erin', UC_A]]);
  });
});
