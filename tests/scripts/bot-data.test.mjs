/**
 * push の前に Actions の公開データのコミットを取り込むかの判定（scripts/lib/bot-data.mjs。T32）。
 * 取り込む見本（陽性）と止める見本（陰性）の両方で確かめる。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BOT, BOT_EMAIL, botDataPlan } from '../../scripts/lib/bot-data.mjs';

const bot = [BOT, BOT_EMAIL, BOT, BOT_EMAIL].join('|');
const data = ['public/data/markers.json'];
const plan = (over) => botDataPlan({ identities: [bot], files: data, dirty: [], staged: [], ...over });

test('origin にだけあるコミットが無ければ何もしない', () => {
  assert.equal(plan({ identities: [], files: [] }).action, 'none');
});

test('ボットの公開データだけで作業ツリーがきれいなら rebase', () => {
  assert.equal(plan({ identities: [bot, bot] }).action, 'rebase');
});

test('ほかのファイルに書きかけがあれば merge（作業ツリーに触れない）', () => {
  assert.equal(plan({ dirty: ['src/app/App.tsx'] }).action, 'merge');
});

test('ボット以外のコミットが混ざっていたら止める', () => {
  const p = plan({ identities: [bot, 'someone|a@example.com|someone|a@example.com'] });
  assert.equal(p.action, 'stop');
  assert.match(p.reason, /someone/);
});

test('名前だけボットを名乗ったコミット（メールが違う）は止める', () => {
  assert.equal(plan({ identities: [`${BOT}|me@example.com|${BOT}|me@example.com`] }).action, 'stop');
});

test('ボットでも公開データの 3 ファイル以外を変えていたら止める', () => {
  assert.equal(plan({ files: [...data, 'public/data/other.json'] }).action, 'stop');
  assert.equal(plan({ files: [...data, 'package.json'] }).action, 'stop');
});

test('取り込む公開データに未コミットの変更（サンプルの戻し忘れなど）があれば止める', () => {
  const p = plan({ dirty: data });
  assert.equal(p.action, 'stop');
  assert.match(p.reason, /git checkout/);
});

test('別のチャットがステージした変更があれば止める（merge が始まる前に拒否されるため）', () => {
  assert.equal(plan({ dirty: ['src/a.ts'], staged: ['src/a.ts'] }).action, 'stop');
});
