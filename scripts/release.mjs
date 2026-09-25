/**
 * 本番への反映を、決まった順番で最後まで行う（手順は /publish）。途中で失敗したらそこで止まり、どこまで終わったかを出す。
 *
 *   npm run release                     ルールに変更があれば先に反映 → push → 公開を待つ → smoke → Actions の注記を数える
 *   npm run release -- --sync           さらに同期ワークフローを実行して、公開データの件数を出す
 *   npm run release -- "メッセージ"     未コミットの変更があれば、このメッセージでコミットする
 *
 * 順番の理由:
 * - ルールはコードより先に反映する。新しい画面の書き込みが古いルールで拒否されるため（10-project-policy）。
 * - 物理削除（reset-data）のあとは同期で公開データを作り直す（ADR 0013）ので --sync を付ける。
 *
 * 取り消せない操作（本番ルールの反映・push）をするので、実行前に利用者の承認を 1 回取ること。
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const SYNC = args.includes('--sync');
const message = args.find((a) => !a.startsWith('--'));
const SITE = 'https://loca-project.github.io';
const GH = existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';

const done = [];
function stop(step, detail) {
  console.error(`\nNG: 「${step}」で止まりました。${detail}`);
  console.error(`終わった段: ${done.length ? done.join(' → ') : '(なし)'}`);
  process.exit(1);
}
const out = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8' }).trim();

/**
 * npm の本体（npm-cli.js）を node で直接起動する。
 * shell: true に引数配列を渡すと Node が DEP0190 を警告し、引数もクォートされない（空白入りのメッセージが分かれる）。
 * npm run 経由なら npm_execpath に本体の場所が入る。直接 node で起動したときは node と同じ場所の npm を使う。
 */
const NPM_CLI = process.env.npm_execpath?.endsWith('.js')
  ? process.env.npm_execpath
  : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

/** npm のスクリプトを出力をそのまま見せて実行する。 */
function npm(step, script, extra = []) {
  console.log(`\n=== ${step} ===`);
  const r = spawnSync(process.execPath, [NPM_CLI, 'run', script, ...(extra.length ? ['--', ...extra] : [])], { stdio: 'inherit' });
  if (r.status !== 0) stop(step, `npm run ${script} が終了コード ${r.status} で終わりました。`);
  done.push(step);
}

// 1. ルールに未反映の変更があれば先に反映する（origin より先のコミットか、作業中の変更にあるとき）
out('git', ['fetch', '-q', 'origin']);
const rulesChanged =
  out('git', ['diff', '--name-only', 'origin/main', '--', 'firestore.rules']) !== '';
if (rulesChanged) npm('本番ルールの反映', 'deploy:rules');
else console.log('ルールの変更なし（反映しない）');

// 2. 検証してコミット・push、3. 公開を待つ
npm('検証と push', 'deploy', message ? [message] : []);
npm('公開の待機', 'pages:wait');

// 4. 同期（--sync のとき）
if (SYNC) {
  console.log('\n=== 同期 ===');
  const R = 'loca-project/loca-project.github.io';
  const latest = () => out(GH, ['run', 'list', '-R', R, '--workflow', 'sync-firestore.yml', '-L', '1', '--json', 'databaseId', '-q', '.[0].databaseId']);
  const before = latest();
  out(GH, ['workflow', 'run', 'sync-firestore.yml', '-R', R]);
  let id = before;
  for (let i = 0; i < 30 && id === before; i += 1) {
    await sleep(2000);
    id = latest();
  }
  if (id === before) stop('同期', '実行が 60 秒以内に始まりませんでした。');
  const watch = spawnSync(GH, ['run', 'watch', id, '-R', R, '--exit-status', '--interval', '10'], { stdio: 'ignore' });
  const jobs = out(GH, ['run', 'view', id, '-R', R, '--json', 'jobs', '-q', '.jobs[] | "\\(.name) \\(.conclusion)"']);
  console.log(jobs);
  if (watch.status !== 0) stop('同期', `run ${id} が失敗しました。gh run view ${id} -R ${R} --log-failed で確かめてください。`);
  out('git', ['pull', '--ff-only', '-q']);
  for (const f of ['markers', 'requests']) {
    const res = await fetch(`${SITE}/data/${f}.json?t=${Date.now()}`, { cache: 'no-store' });
    console.log(`公開データ ${f}: ${res.ok ? (await res.json()).markers.length + ' 件' : `HTTP ${res.status}`}`);
  }
  done.push('同期');
}

// 5. 公開サイトの煙テスト
npm('smoke', 'smoke', [`${SITE}/`]);

// 6. Actions の注記（非推奨・移行の予告）と失敗したジョブを数える。注記は止めずに出すだけ（登録は /tasks）
npm('Actions の注記', 'actions:warnings');

console.log(`\nOK: ${done.length} 段すべて完了（${done.join(' → ')}）`);
