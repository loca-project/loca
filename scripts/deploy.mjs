/**
 * 1 コマンドで GitHub Pages へ公開する。
 *
 *   npm run deploy            （project/ で実行。ワークスペースのルートからでも委譲される）
 *
 * やること: コミット済みの HEAD を検証（check。ルール・アダプタを変えていれば test:rules も）→ push。
 * コミットはしない。未コミットの変更（別のチャットの書きかけかもしれない）は検証にも公開にも含めない。
 * push すると .github/workflows/deploy.yml が走り、Pages に反映される。
 *
 * 検証に落ちたらそこで止まる。壊れたものを push しないため。
 *
 * git リポジトリのルートは project/ 自身。ワークスペース側（.claude/ や CLAUDE.md）は
 * リポジトリの外なので公開されない。
 */

import { execFileSync } from 'node:child_process';
import { checkHead, needsRuleTests } from './check-head.mjs';
import { dirtyFiles } from './lib/head-snapshot.mjs';

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

/** refspec を push し、出力を見せる。失敗は例外にせず、git の出力を返す。 */
function pushRef(refspec) {
  process.stdout.write(`\n$ git push -u origin ${refspec}\n`);
  try {
    const out = execFileSync('git', ['push', '-u', 'origin', refspec], { cwd: CWD, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(out);
    return { ok: true, text: '' };
  } catch (e) {
    const text = `${e?.stdout ?? ''}${e?.stderr ?? ''}`;
    process.stdout.write(text);
    return { ok: false, text };
  }
}

/**
 * push する。GitHub が 500（Internal Server Error）を返したら、未 push のコミットを古い順に 1 件ずつ push し直す。
 * 2026-09-24 に 2 件まとめての push が 3 回続けて 500 になり、1 件ずつなら通った（原因は未確認）。
 * ほかの失敗（拒否・認証など）は直さずに止める（CP-4）。
 */
function push(branch) {
  const first = pushRef(branch);
  if (first.ok) return;
  if (!/Internal Server Error|HTTP 5\d\d/i.test(first.text)) throw new Error(first.text.trim());
  const pending = tryGit(['rev-list', '--reverse', `origin/${branch}..HEAD`]).out.split('\n').filter(Boolean);
  console.log(`\nGitHub が 500 を返したので、未 push の ${pending.length} 件を 1 件ずつ push し直します。`);
  for (const sha of pending) {
    const one = pushRef(`${sha}:refs/heads/${branch}`);
    if (!one.ok) throw new Error(`1 件ずつの push も ${sha.slice(0, 7)} で失敗しました。\n${one.text.trim()}`);
  }
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

// --- 2. コミットはしない。push するのはコミット済みのものだけ ----------------
// 以前は git add -A で作業ツリーをすべてコミットしていた。複数のチャットが同じ作業ツリーを編集していると、
// 他人の書きかけまで公開してしまう（2026-09-25 T29）。自分の変更は stage-mine でコミットしてから呼ぶ。
if (process.argv.slice(2).some((a) => !a.startsWith('--'))) {
  console.log('\n注意: メッセージが渡されましたが、deploy はもうコミットしません（stage-mine でコミットしてから公開する）。');
}
const dirty = dirtyFiles(CWD);
if (dirty.length > 0) {
  console.log(`\n未コミットの変更 ${dirty.length} ファイルは公開しません:\n  ${dirty.slice(0, 20).join('\n  ')}`);
}
const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']).out;
const ahead = tryGit(['rev-list', '--count', `origin/${branch}..HEAD`]).out;
if (ahead === '0') fail(`push するコミットがありません（origin/${branch} と同じ）。先に自分の変更をコミットしてください。`);

// --- 3. 品質チェック（HEAD で。落ちたら push しない）-------------------------
try {
  await checkHead({ rules: needsRuleTests(CWD), root: CWD });
} catch (e) {
  fail(`検証に失敗したため公開を中止しました（${e.message}）。上のログを確認してください。`);
}

// --- 4. push -----------------------------------------------------------------
try {
  console.log(`\npush するコミット: ${ahead} 件`);
  push(branch);

  console.log(`\nOK: ${remote.out} の ${branch} に push しました。`);
  console.log('GitHub Actions がビルドして Pages に公開します（数分）。');
  console.log('進捗: リポジトリの Actions タブで確認できます。');
} catch (e) {
  const detail = e?.stderr?.toString().trim() || e?.message || String(e);
  fail(`git 操作に失敗しました。\n${detail}`);
}
