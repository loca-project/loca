/**
 * 初期読み込みの JS（index.html が読む JS）を、元のファイルごとの大きさに分けて出す（T62 の調査を自動化）。
 * verify の「初期読み込みの JS が 260 kB 以内」が近づいたとき、何を遅延読み込みにするかを決めるために使う。
 *
 *   npm run size:breakdown            上位 30 ファイル
 *   npm run size:breakdown -- 60      上位 60 ファイル
 *
 * ソースマップ付きで OS の一時フォルダにビルドする（dist は触らない）。
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TOP = Number(process.argv[2] ?? 30);
const out = mkdtempSync(path.join(tmpdir(), 'loca-size-'));

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** ソースマップの VLQ の 1 区切りを数の並びにする */
function decode(seg) {
  const values = [];
  let value = 0;
  let shift = 0;
  for (const ch of seg) {
    const d = B64.indexOf(ch);
    value += (d & 31) << shift;
    if (d & 32) {
      shift += 5;
      continue;
    }
    values.push(value & 1 ? -(value >>> 1) : value >>> 1);
    value = 0;
    shift = 0;
  }
  return values;
}

/** 1 つの JS の各バイトを、ソースマップで元のファイルに振り分ける */
function attribute(jsFile, sizes) {
  const map = JSON.parse(readFileSync(`${jsFile}.map`, 'utf8'));
  const lines = readFileSync(jsFile, 'utf8').split('\n');
  let src = 0;
  map.mappings.split(';').forEach((lineMap, li) => {
    const text = lines[li] ?? '';
    let col = 0;
    const starts = [];
    for (const seg of lineMap ? lineMap.split(',').map(decode) : []) {
      col += seg[0];
      if (seg.length > 1) src += seg[1];
      starts.push([col, seg.length > 1 ? src : -1]);
    }
    starts.forEach(([c, s], i) => {
      const end = i + 1 < starts.length ? starts[i + 1][0] : text.length;
      const name = s >= 0 ? map.sources[s].replace(/^.*node_modules\//, 'node_modules/').replace(/^.*?\/project\//, '') : '(対応なし)';
      sizes.set(name, (sizes.get(name) ?? 0) + (end - c));
    });
  });
}

try {
  // 引数に利用者の入力は含まない（一時フォルダの名前だけ）
  execSync(`npx vite build --sourcemap --outDir "${out}" --emptyOutDir --logLevel error`, { stdio: ['ignore', 'ignore', 'inherit'] });
  const html = readFileSync(path.join(out, 'index.html'), 'utf8');
  const initial = [...new Set([...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
  const sizes = new Map();
  let total = 0;
  for (const file of initial) {
    const full = path.join(out, file);
    total += readFileSync(full).length;
    attribute(full, sizes);
  }
  const rows = [...sizes].sort((a, b) => b[1] - a[1]);
  console.log(`初期読み込みの JS: ${(total / 1024).toFixed(1)} KiB（${initial.join('・')}）`);
  for (const [name, bytes] of rows.slice(0, TOP)) console.log(`${(bytes / 1024).toFixed(1).padStart(7)} KiB  ${name}`);
  console.log(`元のファイル ${rows.length} 個のうち上位 ${Math.min(TOP, rows.length)} 個を表示`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
