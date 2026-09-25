/**
 * 直近の Actions の実行から、ジョブの結果・runner の版・警告（非推奨・移行の予告など）を数える（T16 の手作業を自動化）。
 *
 *   npm run actions:warnings              HEAD の公開と、最新の同期を見る
 *   npm run actions:warnings -- <run ID>  指定した実行だけを見る（複数可）
 *
 * 失敗したジョブがあれば終了コード 1。警告は出力するが止めない（/publish の最後に release.mjs が呼ぶ）。
 * 警告が出たら /tasks で登録する（既存のタスクと重複させない）。
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const REPO = 'loca-project/loca-project.github.io';
const GH = existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const gh = (args) => execFileSync(GH, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const json = (args) => JSON.parse(gh(args) || 'null');

/** 見る実行: 引数があればそれ、無ければ HEAD の push の実行と、最新の同期の実行 */
function targetRuns() {
  const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  if (ids.length) return ids;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const pushed = json(['run', 'list', '-R', REPO, '--commit', head, '-L', '5', '--json', 'databaseId']) ?? [];
  const sync = json(['run', 'list', '-R', REPO, '--workflow', 'sync-firestore.yml', '-L', '1', '--json', 'databaseId']) ?? [];
  return [...new Set([...pushed, ...sync].map((r) => String(r.databaseId)))];
}

/** 知らせる注記: 警告と失敗はすべて、notice は非推奨・移行の予告だけ */
const worth = (a) => a.annotation_level !== 'notice' || /deprecat|migrat|will (use|be)|非推奨/i.test(a.message);

let failures = 0;
const warnings = new Map();
for (const id of targetRuns()) {
  const run = json(['run', 'view', id, '-R', REPO, '--json', 'displayTitle,workflowName,conclusion,jobs']);
  console.log(`\n${run.workflowName}「${run.displayTitle}」 run ${id}: ${run.conclusion || '実行中'}`);
  for (const job of run.jobs) {
    const detail = json(['api', `repos/${REPO}/actions/jobs/${job.databaseId}`]);
    const labels = (detail?.labels ?? []).join(',') || '-';
    const notes = (json(['api', `repos/${REPO}/check-runs/${job.databaseId}/annotations`]) ?? []).filter(worth);
    if (job.conclusion === 'failure') failures += 1;
    console.log(`  ${job.conclusion === 'failure' ? 'NG' : 'OK'}  ${job.name}（${job.conclusion || '実行中'}・${labels}）注記 ${notes.length} 件`);
    for (const n of notes) {
      const key = `${n.annotation_level}: ${n.message.split('\n')[0].slice(0, 180)}`;
      warnings.set(key, (warnings.get(key) ?? 0) + 1);
    }
  }
}

console.log(`\n失敗したジョブ ${failures} 件・知らせる注記 ${warnings.size} 種類`);
for (const [key, count] of warnings) console.log(`  ${count} ジョブ  ${key}`);
if (warnings.size) console.log('注記があれば /tasks で登録する（既存のタスクと重複させない）');
process.exit(failures ? 1 : 0);
