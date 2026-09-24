/**
 * 本番に反映中の Firestore ルールが、手元の firestore.rules と一致するかを確かめる。読むだけ。
 *
 *   npm run rules:diff    一致すれば終了コード 0、食い違えば 1（違う行を先頭から 10 か所まで出す）
 *
 * deploy:rules の最後にも走る（反映できたことを、probe の外形だけでなく中身で確かめる）。
 * Firebase CLI にログイン中のオーナーの権限で Firebase Rules API を呼ぶ（lib/owner-auth.mjs）。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT, call, fail, ownerToken } from './lib/owner-auth.mjs';

const { token } = await ownerToken();
const release = await call(token, 'GET', `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`);
if (!release?.rulesetName) fail('本番のルールの反映（releases/cloud.firestore）が見つかりません');
const ruleset = await call(token, 'GET', `https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
const live = (ruleset?.source?.files?.[0]?.content ?? '').replace(/\r\n/g, '\n').split('\n');
const local = (await readFile(path.join(process.cwd(), 'firestore.rules'), 'utf8')).replace(/\r\n/g, '\n').split('\n');

const diffs = [];
for (let i = 0; i < Math.max(live.length, local.length) && diffs.length < 10; i += 1) {
  if (live[i] !== local[i]) diffs.push(`${i + 1} 行目\n  本番: ${live[i] ?? '（無し）'}\n  手元: ${local[i] ?? '（無し）'}`);
}
console.log(`本番の反映: ${release.updateTime}（${PROJECT}）`);
if (diffs.length > 0) {
  console.log(diffs.join('\n'));
  fail(`本番のルールが手元の firestore.rules と食い違っています（本番 ${live.length} 行・手元 ${local.length} 行）。npm run deploy:rules で反映してください`);
}
console.log(`OK  本番のルールは手元の firestore.rules と一致（${local.length} 行）`);
