/**
 * 1 コマンドで GitHub Pages へ公開する。
 *
 *   npm run deploy            （project/ で実行。ワークスペースのルートからでも委譲される）
 *   npm run deploy -- "メッセージ"
 *
 * やること: 型チェック → ビルド → 検証 → git add / commit / push。
 * push すると .github/workflows/deploy.yml が走り、Pages に反映される。
 *
 * 検証に落ちたらそこで止まる。壊れたものを push しないため。
 *
 * git リポジトリのルートは project/ 自身。ワークスペース側（.claude/ や CLAUDE.md）は
 * リポジトリの外なので公開されない。
 */

import { execFileSync } from 'node:child_process';

const CWD = process.cwd();

function fail(message) {
  console.error(`\nNG: ${message}`);
  process.exit(1);
}

/**
 * git を直接起動する。
 *
 * shell は使わない。Windows で shell: true にすると引数が「連結されるだけで
 * クォートされない」ため、空白を含むコミットメッセージが分割されてしまう。
 */
function git(args, { quiet = false } = {}) {
  if (!quiet) process.stdout.write(`\n$ git ${args.join(' ')}\n`);
  return execFileSync('git', args, {
    cwd: CWD,
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['inherit', 'pipe', 'inherit'],
  });
}

/** git を実行し、失敗しても例外にせず結果を返す。 */
function tryGit(args) {
  try {
    return { ok: true, out: git(args, { quiet: true }).trim() };
  } catch (e) {
    return { ok: false, out: '', error: e };
  }
}

/**
 * npm スクリプトを実行する。
 * npm は Windows では npm.cmd なので shell が要る。渡す引数に空白は無い。
 */
function npm(script) {
  process.stdout.write(`\n$ npm run ${script}\n`);
  execFileSync('npm', ['run', script], {
    cwd: CWD,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

// --- 1. git リポジトリか確認 -------------------------------------------------
const top = tryGit(['rev-parse', '--show-toplevel']);
if (!top.ok) {
  fail(
    'git リポジトリではありません。project/ で次を実行してください:\n' +
      '  git init -b main\n' +
      '  git remote add origin https://github.com/<owner>/<repo>.git',
  );
}

// リポジトリのルートが project/ 自身であることを確かめる。
// 親（ワークスペース）が誤って init されていると .github/ が読まれず公開が動かない。
if (top.out.replace(/\//g, '\\').toLowerCase() !== CWD.toLowerCase()) {
  fail(
    'git のルートが project/ ではありません。\n' +
      `  想定: ${CWD}\n` +
      `  実際: ${top.out}\n` +
      'GitHub はワークフローをリポジトリルート直下の .github/ でしか読みません。\n' +
      '親側の .git を削除し、project/ で git init し直してください。',
  );
}

const remote = tryGit(['remote', 'get-url', 'origin']);
if (!remote.ok) {
  fail('リモート origin がありません。git remote add origin <URL> を実行してください。');
}

// コミット者が未設定だと commit がここではなく途中で落ちる。先に弾く。
const userName = tryGit(['config', 'user.name']);
const userEmail = tryGit(['config', 'user.email']);
if (!userName.ok || !userEmail.ok || !userName.out || !userEmail.out) {
  fail(
    'git のコミット者が未設定です。次を実行してください:\n' +
      '  git config --global user.name "あなたの名前"\n' +
      '  git config --global user.email "あなたのメールアドレス"',
  );
}

// --- 2. 品質チェック（落ちたら push しない）---------------------------------
try {
  npm('typecheck');
  npm('build');
  npm('verify');
} catch {
  fail('検証に失敗したため公開を中止しました。上のログを確認してください。');
}

// --- 3. コミットして push ----------------------------------------------------
const message = process.argv.slice(2).join(' ') || `site: ${new Date().toISOString()}`;

try {
  git(['add', '-A']);

  const staged = tryGit(['diff', '--cached', '--name-only']).out;
  if (!staged) {
    console.log('\n変更がないため、コミットをスキップしました。');
  } else {
    console.log(`\n変更 ${staged.split('\n').length} ファイル`);
    git(['commit', '-m', message]);
  }

  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']).out;
  git(['push', '-u', 'origin', branch]);

  console.log(`\nOK: ${remote.out} の ${branch} に push しました。`);
  console.log('GitHub Actions がビルドして Pages に公開します（数分）。');
  console.log('進捗: リポジトリの Actions タブで確認できます。');
} catch (e) {
  const detail = e?.stderr?.toString().trim() || e?.message || String(e);
  fail(`git 操作に失敗しました。\n${detail}`);
}
