/**
 * ブラウザ用の API キーのリファラー制限が ADR 0030 のとおりに効いているかを確かめる（読むだけ。T32）。
 *
 *   npm run keys:check     期待と違えば非ゼロ終了。キーの文字列は出さない。
 *
 * 1. Google Cloud のキーの設定（許可するリファラー）が一覧と一致する
 * 2. ログインの API（identitytoolkit）が、許可したリファラーでは 200、それ以外では 403 を返す
 *    Firestore はキーを検査しないので、制限の効き目は identitytoolkit で見る（ADR 0030）。
 * オーナーの権限は Firebase CLI のログインを使う（gcloud は不要。scripts/lib/owner-auth.mjs）。
 */

import { PROJECT, call, ownerToken } from './lib/owner-auth.mjs';

/** 許可するリファラー。変えるときは ADR 0030 の表も直す。 */
export const REFERRERS = [
  'https://loca-project.github.io/*',
  `https://${PROJECT}.firebaseapp.com/*`,
  'http://localhost:5173/*',
  'http://localhost:4173/*',
];
const DENIED = ['', 'https://example.com/', 'http://127.0.0.1:5173/'];

const KEYS = `https://apikeys.googleapis.com/v2/projects/${PROJECT}/locations/global/keys`;
const { token } = await ownerToken();
const keys = (await call(token, 'GET', KEYS))?.keys ?? [];
const key = keys.find((k) => k.displayName === 'Browser key (auto created by Firebase)');
if (!key) {
  console.error('NG: ブラウザ用のキー（Browser key (auto created by Firebase)）が見つかりません');
  process.exit(1);
}

let passed = 0;
let total = 0;
function check(name, ok, detail) {
  total += 1;
  if (ok) passed += 1;
  console.log(`${ok ? 'OK' : 'NG'}  ${name} — ${detail}`);
}

const now = key.restrictions?.browserKeyRestrictions?.allowedReferrers ?? [];
const same = now.length === REFERRERS.length && REFERRERS.every((r) => now.includes(r));
check('キーの許可リファラーが ADR 0030 と一致', same, now.length ? now.join(' ') : '制限なし');

const { keyString } = await call(token, 'GET', `https://apikeys.googleapis.com/v2/${key.name}/keyString`);
const url = `https://identitytoolkit.googleapis.com/v1/projects?key=${keyString}`;
async function statusWith(referer) {
  try {
    const res = await fetch(url, { headers: referer ? { Referer: referer } : {} });
    const reason = ((await res.text()).match(/"reason":\s*"([A-Z_]+)"/) ?? [])[1] ?? '';
    return { status: res.status, text: `${res.status}${reason ? ` ${reason}` : ''}` };
  } catch (e) {
    // URL にキーが入っているので、例外はメッセージだけを出す（スタックや cause に URL が出ないように）
    return { status: 0, text: `接続できない（${e instanceof Error ? e.message : String(e)}）` };
  }
}
for (const pattern of REFERRERS) {
  const r = await statusWith(pattern.replace('*', ''));
  check(`許可: ${pattern}`, r.status === 200, r.text);
}
for (const referer of DENIED) {
  const r = await statusWith(referer);
  check(`拒否: ${referer || 'Referer なし'}`, r.status === 403, r.text);
}

console.log(`\n${passed} / ${total} 件 OK（${PROJECT}）`);
if (passed !== total) process.exit(1);
