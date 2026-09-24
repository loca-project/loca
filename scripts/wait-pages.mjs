/**
 * push した HEAD の Actions（Deploy on push）が終わるのを待ち、公開サイトが新しい版になったかを確かめる。
 *
 *   npm run pages:wait
 *
 * 判定: 1) HEAD のコミットに対応する実行が success で終わる
 *       2) 公開 URL の index.html が 200 で、ローカルの dist/index.html と同じ JS を読み込んでいる
 * 2) はローカルの dist が HEAD のビルドであることが前提（npm run deploy の直後に実行する）。
 *
 * gh（GitHub CLI）が要る。PATH に無ければ既定のインストール先を探す（VS Code は再起動まで PATH を読み直さない）。
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const GH_CANDIDATES = ['gh', 'C:\\Program Files\\GitHub CLI\\gh.exe'];

function fail(message, code = 1) {
  console.error(`NG: ${message}`);
  process.exit(code);
}

function findGh() {
  for (const cmd of GH_CANDIDATES) {
    if (cmd !== 'gh' && !existsSync(cmd)) continue;
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' });
      return cmd;
    } catch {
      // 次の候補へ
    }
  }
  return fail('gh が見つかりません。winget install --id GitHub.cli -e で入れてください。', 2);
}

const gh = findGh();
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();

const sha = run('git', ['rev-parse', 'HEAD']);
const repo = run('git', ['remote', 'get-url', 'origin']).replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '');

// 1. HEAD の実行を探して完了まで待つ（push 直後は実行がまだ無いことがある）
let runId = '';
for (let i = 0; i < 20 && !runId; i += 1) {
  runId = run(gh, ['run', 'list', '-R', repo, '--commit', sha, '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId']);
  if (!runId) await sleep(3000);
}
if (!runId) fail(`${sha.slice(0, 7)} の Actions の実行が 60 秒以内に見つかりません。push されているか確かめてください。`);

console.log(`待機: run ${runId}（${sha.slice(0, 7)}）`);
try {
  execFileSync(gh, ['run', 'watch', runId, '-R', repo, '--exit-status', '--interval', '10'], { stdio: 'ignore' });
} catch {
  fail(`Actions が失敗しました。gh run view ${runId} -R ${repo} --log-failed で原因を確かめてください。`);
}
console.log('OK  Actions が成功した');

// 2. 公開サイトが同じビルドを配っているか
const owner = repo.split('/')[0];
const name = repo.split('/')[1];
const siteUrl = name === `${owner}.github.io` ? `https://${name}/` : `https://${owner}.github.io/${name}/`;
const scripts = (html) => [...html.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0]).sort().join(',');

const local = scripts(await readFile(path.join(ROOT, 'dist', 'index.html'), 'utf8'));
let same = false;
for (let i = 0; i < 10 && !same; i += 1) {
  const res = await fetch(siteUrl, { cache: 'no-store' });
  same = res.ok && scripts(await res.text()) === local;
  if (!same) await sleep(6000);
}
console.log(`${same ? 'OK ' : 'NG '} ${siteUrl} がローカルの dist と同じ JS を配っている`);
if (!same) fail('公開サイトが古いままです。CDN の反映待ちの可能性があります。数分後に再実行してください。');
