/**
 * 機器マスタの検査と組み立て（scripts/lib/equipment-master.mjs。ADR 0025）。
 * 実行: npm run test:scripts（npm run check に含む）
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEquipment, checkDefault, checkMakers } from '../../scripts/lib/equipment-master.mjs';
import { EQUIPMENT_MASTER } from '../../scripts/data/equipment-master.mjs';

const gopro = [{ name: 'GoPro', series: [{ name: 'HERO', models: ['HERO13 Black', 'HERO12 Black'] }] }];

describe('checkMakers', () => {
  it('正しい一覧は問題 0 件', () => {
    assert.deepEqual(checkMakers('action', gopro), []);
  });

  it('重複・空・80 字超・改行入りの名前を拾う', () => {
    const bad = [
      { name: 'GoPro', series: [{ name: 'HERO', models: ['A', 'A', ''] }] },
      { name: 'GoPro', series: [] },
      { name: 'x'.repeat(81), series: [] },
      { name: 'a\nb', series: [] },
    ];
    assert.equal(checkMakers('action', bad).length, 5);
  });

  it('1 分類のシリーズ・モデルの件数の上限を超えたら拾う', () => {
    const series = Array.from({ length: 201 }, (_, i) => ({ name: `S${i}`, models: [] }));
    assert.equal(checkMakers('action', [{ name: 'X', series }]).length, 1);
    const models = Array.from({ length: 1001 }, (_, i) => `M${i}`);
    assert.equal(checkMakers('action', [{ name: 'X', series: [{ name: 'S', models }] }]).length, 1);
  });

  it('一覧でないものを拾う', () => {
    assert.equal(checkMakers('action', 'GoPro').length, 1);
    assert.equal(checkMakers('action', [{ name: 'GoPro', series: 'HERO' }]).length, 1);
  });
});

describe('checkDefault', () => {
  it('コードの既定は問題 0 件', () => {
    assert.deepEqual(checkDefault(), []);
  });
});

describe('buildEquipment', () => {
  it('文書が無ければコードの既定そのもの', () => {
    const { defs, edited, problems } = buildEquipment([]);
    assert.deepEqual(defs, EQUIPMENT_MASTER.map((c) => ({ category: c.category, makers: c.makers })));
    assert.deepEqual([edited, problems], [[], []]);
  });

  it('直した分類だけを置き換え、分類の並びは変えない', () => {
    const { defs, edited } = buildEquipment([{ id: 'action', makers: gopro, updatedBy: 'root' }]);
    assert.deepEqual(defs.map((d) => d.category), EQUIPMENT_MASTER.map((c) => c.category));
    assert.deepEqual(defs.find((d) => d.category === 'action').makers, gopro);
    assert.deepEqual(edited, ['action']);
  });

  it('知らない分類と検査に落ちた文書は使わず、既定のまま NG に残す', () => {
    const { defs, edited, problems } = buildEquipment([
      { id: 'tripod', makers: gopro },
      { id: 'drone', makers: [{ name: '', series: [] }] },
    ]);
    assert.deepEqual(edited, []);
    assert.equal(problems.length, 2);
    assert.deepEqual(defs.find((d) => d.category === 'drone').makers, EQUIPMENT_MASTER[0].makers);
  });
});
