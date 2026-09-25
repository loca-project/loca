/**
 * .github/workflows/*.yml の決まりを検査する（npm run verify から呼ぶ。規約は .claude/rules/20-github-actions.md）。
 * YAML の解析器には頼らず、行で見る（依存を増やさないため）。通信しない。
 */

/** Node.js 24 で動く最小の版（T16）。これより古い版は非推奨の警告が出る */
export const MIN_ACTION_MAJOR = {
  'actions/checkout': 5,
  'actions/setup-node': 5,
  'actions/upload-pages-artifact': 4,
  'actions/deploy-pages': 5,
};

/**
 * @param {Array<{ file: string, text: string }>} workflows
 * @returns {string[]} 問題（空なら OK）。「ファイル名: 内容」の形
 */
export function lintWorkflows(workflows) {
  const problems = [];
  for (const { file, text } of workflows) {
    const lines = text.split(/\r?\n/);
    const say = (msg) => problems.push(`${file}: ${msg}`);

    if (/\t/.test(text)) say('タブ文字がある（YAML ではインデントに使えない）');

    // 名前は日本語の「種類（補足）」（T31）
    const name = lines.find((l) => /^name:\s*\S/.test(l));
    if (!name) say('トップレベルの name が無い');
    else if (!/[^\x00-\x7F]/.test(name)) say(`name が日本語でない（${name.trim()}）`);

    // runner は版を固定する（ubuntu-latest は切り替わりの間に版が混ざる。T16）
    for (const l of lines) {
      const m = /^\s*runs-on:\s*(\S+)/.exec(l);
      if (m && !/^ubuntu-\d+\.\d+$/.test(m[1])) say(`runs-on が版の固定でない（${m[1]}）`);
    }

    // Actions の版が Node.js 24 対応か
    for (const l of lines) {
      const m = /uses:\s*([\w.-]+\/[\w.-]+)@v(\d+)/.exec(l);
      if (!m) continue;
      const min = MIN_ACTION_MAJOR[m[1]];
      if (min && Number(m[2]) < min) say(`${m[1]}@v${m[2]} は古い（v${min} 以上。Node.js 20 は非推奨）`);
    }

    // if などで比べる cron の文字列が、on.schedule にあること（片方だけ変えると毎時の分岐が効かなくなる。T57）
    const crons = new Set([...text.matchAll(/-\s*cron:\s*'([^']+)'/g)].map((m) => m[1]));
    for (const m of text.matchAll(/github\.event\.schedule\s*==\s*'([^']+)'/g)) {
      if (!crons.has(m[1])) say(`比べている cron '${m[1]}' が on.schedule に無い`);
    }
  }
  return problems;
}
