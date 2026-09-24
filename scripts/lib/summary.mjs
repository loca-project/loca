/**
 * Actions のジョブ概要（GITHUB_STEP_SUMMARY）に件数の表を書く（T31）。
 * Actions の外（手元の実行）では何もしない。書けなくても処理は止めない（概要は付け足しの情報のため）。
 */

import { appendFileSync } from 'node:fs';

const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/**
 * @param {string} title 見出し（例: '同期'）
 * @param {Array<[string, string | number]>} rows 項目と値
 * @param {string} [file] 書き先。既定は GITHUB_STEP_SUMMARY
 * @returns {string} 書いた Markdown（書き先が無ければ空文字）
 */
export function writeSummary(title, rows, file = process.env.GITHUB_STEP_SUMMARY) {
  if (!file) return '';
  const md = [`### ${cell(title)}`, '', '| 項目 | 値 |', '|---|---|', ...rows.map(([k, v]) => `| ${cell(k)} | ${cell(v)} |`), '', ''].join('\n');
  try {
    appendFileSync(file, md, 'utf8');
  } catch (e) {
    console.warn(`[summary] ジョブ概要を書けませんでした: ${e instanceof Error ? e.message : e}`);
    return '';
  }
  return md;
}
