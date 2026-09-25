/**
 * 本番のルールを反映して確かめる（npm run deploy:rules。手順は /firebase-rules）。
 *
 * 反映するのはコミット済みのルールだけ。rules/ か firestore.rules に未コミットの変更があれば、
 * HEAD を取り出した場所で行う（別のチャットのレビュー前のルールを本番に出さないため。2026-09-25 T29）。
 * 順番: test:rules → firebase deploy（ルールと索引 firestore.indexes.json）→ rules:probe（未ログインの読み書き）→ rules:diff（本番と HEAD の一致）
 *
 * 本番のルールが入れ替わる操作なので、実行前に利用者の承認を 1 回取ること。
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirtyFiles, withHeadSnapshot } from './lib/head-snapshot.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEPS = ['test:rules', 'rules:publish', 'rules:probe', 'rules:diff'];

function npm(cwd, script) {
  const cli = process.env.npm_execpath?.endsWith('.js')
    ? process.env.npm_execpath
    : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  console.log(`\n=== npm run ${script} ===`);
  const r = spawnSync(process.execPath, [cli, 'run', script], { cwd, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`npm run ${script} が終了コード ${r.status} で終わりました`);
}

const done = [];
const run = (cwd) => {
  for (const step of STEPS) {
    npm(cwd, step);
    done.push(step);
  }
};

try {
  const dirty = dirtyFiles(ROOT, ['rules', 'firestore.rules']);
  if (dirty.length === 0) run(ROOT);
  else {
    console.log(`未コミットのルールの変更は反映しません: ${dirty.join(', ')}`);
    await withHeadSnapshot(ROOT, run);
  }
  console.log('\nOK: コミット済みのルールを本番に反映し、本番と一致することを確かめました');
} catch (e) {
  console.error(`\nNG: ${e.message}`);
  console.error(`終わった段: ${done.length ? done.join(' → ') : '(なし)'}`);
  process.exit(1);
}
