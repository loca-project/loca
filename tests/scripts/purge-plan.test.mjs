/**
 * 物理削除の計画（scripts/lib/purge-plan.mjs。ADR 0021・T58）。通信しない。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planPurge } from '../../scripts/lib/purge-plan.mjs';

const DAY = 86_400_000;
const now = Date.parse('2026-12-31T00:00:00Z');
const synced = now - DAY; // 公開データは昨日作り直した
const base = { markers: [], requests: [], videos: [], now, syncedAt: synced };

describe('planPurge', () => {
  it('論理削除から 30 日たったマーカーだけを消す（29 日・未削除は残す）', () => {
    const plan = planPurge({
      ...base,
      markers: [
        { id: 'old', deleted: true, updatedAt: now - 31 * DAY },
        { id: 'recent', deleted: true, updatedAt: now - 29 * DAY },
        { id: 'alive', deleted: false, updatedAt: now - 400 * DAY },
      ],
    });
    assert.deepEqual(plan.markerIds, ['old']);
  });

  it('取り下げから 30 日たった撮影リクエストだけを消す', () => {
    const plan = planPurge({
      ...base,
      requests: [
        { id: 'old', withdrawn: true, updatedAt: now - 40 * DAY },
        { id: 'alive', updatedAt: now - 40 * DAY },
      ],
    });
    assert.deepEqual(plan.requestIds, ['old']);
  });

  it('同期が止まって公開データが古いときは、同期より前の削除だけを消す', () => {
    const plan = planPurge({
      ...base,
      syncedAt: now - 60 * DAY,
      markers: [
        { id: 'beforeSync', deleted: true, updatedAt: now - 70 * DAY },
        { id: 'afterSync', deleted: true, updatedAt: now - 45 * DAY },
      ],
    });
    assert.deepEqual(plan.markerIds, ['beforeSync']);
  });

  it('消すマーカーを指す索引と、指す先の無い索引を外す。禁止の印の付いた索引は残す', () => {
    const plan = planPurge({
      ...base,
      markers: [
        { id: 'old', deleted: true, updatedAt: now - 31 * DAY },
        { id: 'alive', deleted: false, updatedAt: now },
      ],
      videos: [
        { id: 'v_old', markerId: 'old' },
        { id: 'v_blocked', markerId: 'old', blocked: true },
        { id: 'v_alive', markerId: 'alive' },
        { id: 'v_orphan', markerId: 'gone' },
      ],
    });
    assert.deepEqual(plan.videoIds, ['v_old', 'v_orphan']);
  });

  it('公開データの syncedAt が読めなければ止める', () => {
    assert.throws(() => planPurge({ ...base, syncedAt: 0 }), /syncedAt/);
  });

  it('時刻の無い行は消さない', () => {
    assert.deepEqual(planPurge({ ...base, markers: [{ id: 'x', deleted: true }] }).markerIds, []);
  });
});
