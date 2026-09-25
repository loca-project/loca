/**
 * コミット済みの状態（HEAD）だけを検証する。作業ツリーに別のチャットの書きかけがあっても、それに左右されない。
 *
 *   npm run check:head                 HEAD で npm run check（型・ビルド・検証・テスト）
 *   npm run check:head -- --rules      さらに npm run test:rules（エミュレータ。JDK 11 以上）
 *   npm run check:head -- --auto-rules origin より先のコミットがルール・アダプタ・そのテストを変えていれば test:rules も
 *
 * 作業ツリーに未コミットの変更が無ければ、取り出さずにその場で行う（速い）。
 * test:rules を自動で足すのは、2026-09-25 に T56 の変更がストアのテストを壊し、check に含まれないため気づけなかったから。
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirtyFiles, withHeadSnapshot } from './lib/head-snapshot.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** test:rules が要る変更の場所（ルール・Firebase のアダプタ・その共通部品・テスト） */
export const RULES_SENSITIVE = ['rules/', 'firestore.rules', 'src/adapters/firebase/', 'src/runtime/', 'tests/rules/', 'tests/store/'];

/** origin/main より先のコミットが、test:rules の要る場所を変えているか */
export function needsRuleTests(root = ROOT) {
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  return changed.some((f) => RULES_SENSITIVE.some((p) => f.startsWith(p)));
}

/** npm 本体を node で直接起動する（shell: true に引数配列を渡すと DEP0190 の警告が出るため） */
function npm(cwd, script) {
  const cli = process.env.npm_execpath?.endsWith('.js')
    ? process.env.npm_execpath
    : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  console.log(`\n=== npm run ${script}（${cwd === ROOT ? '作業ツリー' : 'HEAD'}）===`);
  const r = spawnSync(process.execPath, [cli, 'run', script], { cwd, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`npm run ${script} が終了コード ${r.status} で終わりました`);
}

/** HEAD を検証する。失敗したら例外。 */
export async function checkHead({ rules = false, root = ROOT } = {}) {
  const run = (cwd) => {
    npm(cwd, 'check');
    if (rules) npm(cwd, 'test:rules');
  };
  const dirty = dirtyFiles(root);
  if (dirty.length === 0) return run(root);
  console.log(`未コミットの変更 ${dirty.length} ファイルは検証に含めません（別のチャットの書きかけかもしれないため）`);
  return withHeadSnapshot(root, run);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const rules = args.includes('--rules') || (args.includes('--auto-rules') && needsRuleTests());
  try {
    await checkHead({ rules });
    console.log(`\nOK: HEAD の検証が通りました${rules ? '（test:rules を含む）' : ''}`);
  } catch (e) {
    console.error(`\nNG: ${e.message}`);
    process.exit(1);
  }
}
