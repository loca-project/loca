/**
 * 公開データを空にする。
 *
 * 実行: npm run data:clear
 *
 * サンプルデータ（npm run seed）を入れたまま公開すると、実在しない動画のマーカーが
 * 並んでしまう。公開前にこれを実行して真っさらな状態に戻す。
 * 機器マスタ（equipment.json）は利用者データではないので消さない。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'public', 'data');
const now = Date.now();

await mkdir(OUT_DIR, { recursive: true });

await writeFile(
  path.join(OUT_DIR, 'markers.json'),
  `${JSON.stringify({ generatedAt: now, markers: [] }, null, 2)}\n`,
  'utf8',
);
await writeFile(
  path.join(OUT_DIR, 'requests.json'),
  `${JSON.stringify({ generatedAt: now, markers: [] }, null, 2)}\n`,
  'utf8',
);

console.log('OK: markers.json と requests.json を空にしました（equipment.json は維持）');
