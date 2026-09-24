/**
 * push した HEAD の Actions（Deploy on push）が終わるのを待ち、公開サイトが新しい版になったかを確かめる。
 *
 *   npm run pages:wait
 *
 * 判定: 1) HEAD のコミットに対応する実行が success で終わる
 *       2) github-pages 環境の最新デプロイが HEAD で success、公開 URL が 200 を返す
 *
 * gh（GitHub CLI）が要る。PATH に無ければ既定のインストール先を探す（VS Code は再起動まで PATH を読み直さない）。
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

// 2. github-pages 環境の最新デプロイが HEAD で、成功し、URL が応答するか
//    JS のファイル名での比較はしない。ローカルと Actions では環境変数（.env.local と Variables）の中身が違いうるので、
//    同じコミットでもハッシュが変わるため。
const api = (p) => run(gh, ['api', p, '--jq', '.']);
const [deploy] = JSON.parse(api(`repos/${repo}/deployments?environment=github-pages&per_page=1`));
const [status] = deploy ? JSON.parse(api(`repos/${repo}/deployments/${deploy.id}/statuses?per_page=1`)) : [];
const deployed = deploy?.sha === sha && status?.state === 'success';
console.log(`${deployed ? 'OK ' : 'NG '} github-pages の最新デプロイが ${sha.slice(0, 7)} で成功している`);
if (!deployed) fail(`最新デプロイは ${deploy?.sha?.slice(0, 7) ?? '(なし)'}（${status?.state ?? '状態不明'}）です。`);

const siteUrl = status.environment_url;
const res = await fetch(siteUrl, { cache: 'no-store' });
console.log(`${res.ok ? 'OK ' : 'NG '} ${siteUrl} が応答する — ${res.status}`);
if (!res.ok) fail('公開サイトが応答しません。');