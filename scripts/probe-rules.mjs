/**
 * 本番の Firestore にルールが反映されているかを、未ログインの REST 呼び出しで確かめる。
 * 初期状態（allow read, write: if false）のままなら 1 件目が 403 になり、差が出る。
 *
 * 実行: npm run rules:probe   期待と違う結果が 1 件でもあれば非ゼロ終了。
 * 設定値は環境変数か .env.local から読む。値そのものは出力しない。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function envValue(key) {
  if (process.env[key]) return process.env[key].trim();
  try {
    const text = await readFile(path.join(ROOT, '.env.local'), 'utf8');
    const line = text.split(/\r?\n/).find((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    return line ? line.replace(/^[^=]*=/, '').trim().replace(/^"|"$/g, '') : '';
  } catch {
    return '';
  }
}

const apiKey = await envValue('VITE_FIREBASE_API_KEY');
const projectId = await envValue('VITE_FIREBASE_PROJECT_ID');
if (!apiKey || !projectId) {
  console.error('VITE_FIREBASE_API_KEY と VITE_FIREBASE_PROJECT_ID が .env.local にありません');
  process.exit(2);
}

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const probes = [
  { name: '未ログインで markers を読める', method: 'GET', url: `${base}/markers?pageSize=1`, expect: 200 },
  {
    name: '未ログインで markers に書けない',
    method: 'POST',
    url: `${base}/markers`,
    body: { fields: { title: { stringValue: 'probe' } } },
    expect: 403,
  },
  { name: '未ログインで admins を読めない', method: 'GET', url: `${base}/admins?pageSize=1`, expect: 403 },
];

let passed = 0;
for (const p of probes) {
  const res = await fetch(`${p.url}${p.url.includes('?') ? '&' : '?'}key=${apiKey}`, {
    method: p.method,
    headers: { 'Content-Type': 'application/json' },
    body: p.body ? JSON.stringify(p.body) : undefined,
  });
  const ok = res.status === p.expect;
  if (ok) passed += 1;
  console.log(`${ok ? 'OK ' : 'NG '} ${p.name} — ${res.status}（期待 ${p.expect}）`);
}
console.log(`\n${passed} / ${probes.length} 件 OK（${projectId}）`);
if (passed !== probes.length) process.exit(1);
