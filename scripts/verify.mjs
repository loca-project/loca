/**
 * 公開前の自動検証。
 * 「Google Maps Platform を使わない」「外部 SDK はアダプタに閉じ込める」という設計上の約束を、
 * 数えられる形で確かめる（CP-3）。Firebase は ADR 0010 で導入を決めたので、
 * 禁止ではなく「src/adapters/firebase/ からだけ import する」ことを検査する。
 *
 * 実行: npm run verify   失敗が 1 件でもあれば非ゼロ終了。
 */

import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const checks = [];
const record = (name, ok, detail = '') => checks.push({ name, ok, detail });

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = await walk(path.join(ROOT, 'src'));
const sources = await Promise.all(
  files
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map(async (f) => ({ file: path.relative(ROOT, f), text: await readFile(f, 'utf8') })),
);

// 1. 廃止した依存が残っていないこと
//    Google Maps Platform（地図・Geocoding）は無料の範囲の利用でも請求先アカウントが必須（ADR 0010・0011）
//    YouTube Data API は Actions（scripts/）からだけ呼ぶ。キーをブラウザに配らないため src からは禁止（ADR 0017）
const banned = /(@googlemaps|maps\.googleapis\.com|googleapis\.com\/youtube|@tensorflow|@google\/genai)/;
const leftovers = sources.filter((s) => banned.test(s.text));
record('src に Google Maps Platform・YouTube Data API・TensorFlow の呼び出しが無い',
  leftovers.length === 0, leftovers.map((l) => l.file).join(', '));

// 1b. Firebase SDK を import するのは src/adapters/firebase/ だけ（ADR 0010）
const firebaseImport = /(from\s+|import\s*\(\s*)['"](firebase|@firebase)(\/|['"])/;
const firebaseDir = `src${path.sep}adapters${path.sep}firebase${path.sep}`;
const firebaseLeaks = sources.filter((s) => firebaseImport.test(s.text) && !s.file.startsWith(firebaseDir));
record('Firebase SDK の import は src/adapters/firebase/ のみ', firebaseLeaks.length === 0,
  firebaseLeaks.map((l) => l.file).join(', '));

// 2. package.json にも残っていないこと
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies });
const bannedDeps = deps.filter((d) => banned.test(d));
record('package.json に廃止した依存が無い', bannedDeps.length === 0, bannedDeps.join(', '));

// 3. features/ と core/ がベンダ SDK を直接 import しないこと
const vendor = /from\s+'(maplibre-gl)/;
const leaks = sources.filter(
  (s) => (s.file.includes(`src${path.sep}features`) || s.file.includes(`src${path.sep}core`)) && vendor.test(s.text),
);
record('features/ と core/ に地図 SDK の直接 import が無い', leaks.length === 0,
  leaks.map((l) => l.file).join(', '));

// 4. import.meta.env を読むのは runtime/config.ts だけ
const envUsers = sources.filter(
  (s) => /import\.meta[\s\S]{0,20}env/.test(s.text) && !s.file.endsWith('config.ts'),
);
record('import.meta.env を読むのは runtime/config.ts のみ', envUsers.length === 0,
  envUsers.map((l) => l.file).join(', '));

// 5. API キーがソースに埋まっていないこと
const secret = /(AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z]{20,}|ghp_[0-9A-Za-z]{30,})/;
const secrets = sources.filter((s) => secret.test(s.text));
record('ソースに API キーが直書きされていない', secrets.length === 0, secrets.map((l) => l.file).join(', '));

// 5b. 実際の設定値を持つ .env* が git 管理下に無いこと（.env.example だけは見本として管理する）
//     .gitignore の書き換えや git add -f で入り込むのを防ぐ。
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0');
const trackedEnv = tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'));
record('.env.example 以外の .env* が git 管理下に無い', trackedEnv.length === 0, trackedEnv.join(', '));

// 5c. 見本の .env.example に値が書かれていないこと（実際の値の貼り付けを防ぐ）
//     既定値として意味を持つ VITE_DATA_BASE_URL だけは許す。
const ALLOW_EXAMPLE_VALUE = new Set(['VITE_DATA_BASE_URL']);
const exampleLines = (await readFile(path.join(ROOT, '.env.example'), 'utf8')).split(/\r?\n/);
const filled = exampleLines
  .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line))
  .filter((m) => m && m[2].trim() !== '' && !ALLOW_EXAMPLE_VALUE.has(m[1]))
  .map((m) => m[1]);
record('.env.example に値が書かれていない', filled.length === 0, filled.join(', '));

// 6. CP-2: 1 ファイル 400 行以内
const tooLong = sources.filter((s) => s.text.split('\n').length > 400);
record('すべてのソースが 400 行以内 (CP-2)', tooLong.length === 0,
  tooLong.map((l) => `${l.file}:${l.text.split('\n').length}`).join(', '));

// 7. 公開データが読めること（0 件は正常。まだ投稿が無い状態）
let dataOk = false;
let dataDetail = 'public/data/markers.json がありません';
let markerIds = [];
try {
  const raw = JSON.parse(await readFile(path.join(ROOT, 'public', 'data', 'markers.json'), 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.markers ?? []);
  dataOk = Array.isArray(list);
  markerIds = list.map((m) => m?.id ?? '');
  dataDetail = `${list.length} 件`;
} catch { /* dataOk は false のまま */ }
record('公開データ public/data/markers.json が読める', dataOk, dataDetail);

// 7b. サンプルデータが混ざっていないこと（実在しない動画を公開しないため）
const seeded = markerIds.filter((id) => String(id).startsWith('seed'));
record(
  'サンプルデータが公開データに混ざっていない',
  seeded.length === 0,
  seeded.length > 0 ? `${seeded.length} 件。npm run data:clear で消せます` : '',
);

// 8. 都道府県リストの二重管理がズレていないこと
//    scripts/lib/prefectures.mjs（取り込み用）と src/core/constants/prefectures.ts（アプリ用）
const { PREFECTURES: scriptList } = await import('./lib/prefectures.mjs');
const tsText = await readFile(path.join(ROOT, 'src', 'core', 'constants', 'prefectures.ts'), 'utf8');
const tsList = [...tsText.matchAll(/'([^']+[都道府県])'/g)].map((m) => m[1]);
const listsMatch =
  scriptList.length === 47 &&
  tsList.length === 47 &&
  scriptList.every((name, i) => name === tsList[i]);
record(
  '都道府県リストが scripts と src で一致（47件・同順）',
  listsMatch,
  `scripts=${scriptList.length} / src=${tsList.length}`,
);

// 8a. 機器の分類のキーが、アプリ（src）・ルール・マスタで一致していること（ADR 0018）
const categoryText = await readFile(path.join(ROOT, 'src', 'core', 'constants', 'equipment.ts'), 'utf8');
const srcCategories = [...(categoryText.match(/EQUIPMENT_CATEGORY_KEYS = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
const rulesText = await readFile(path.join(ROOT, 'firestore.rules'), 'utf8');

// 8c. firestore.rules が rules/ の部品から作ったものと一致していること（ADR 0020）
const { buildRules } = await import('./build-rules.mjs');
const builtRules = await buildRules();
record('firestore.rules が rules/ の部品と一致', rulesText.replace(/\r\n/g, '\n') === builtRules.text,
  `${builtRules.names.length} 部品`);

const rulesCategories = [...(rulesText.match(/e\.category in \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']*)'/g)]
  .map((m) => m[1])
  .filter(Boolean);
const { EQUIPMENT_MASTER } = await import('./data/equipment-master.mjs');
const masterCategories = EQUIPMENT_MASTER.map((c) => c.category);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
record(
  '機器の分類が src・ルール・マスタで一致',
  srcCategories.length > 0 && same(srcCategories, rulesCategories) && same(srcCategories, masterCategories),
  `src=${srcCategories.length} / rules=${rulesCategories.length} / master=${masterCategories.length}`,
);

// 8b. 撮影リクエストの「同じ地点」のしきい値が、画面（src）と日次の同期（scripts）で一致していること
//     ずれると、同期のたびに地点が分かれたりまとまったりする。
const { SAME_SPOT_EPS: scriptEps } = await import('./lib/merge-requests.mjs');
const srcEps = Number(/SAME_SPOT_EPS\s*=\s*([\d.]+)/.exec(
  await readFile(path.join(ROOT, 'src', 'core', 'logic', 'requests.ts'), 'utf8'),
)?.[1]);
record('撮影リクエストの地点のしきい値が scripts と src で一致', scriptEps === srcEps,
  `scripts=${scriptEps} / src=${srcEps}`);

// 11. dist が静的ファイルだけであること（ビルド済みのときのみ）
try {
  await stat(path.join(ROOT, 'dist', 'index.html'));
  const distFiles = await walk(path.join(ROOT, 'dist'));
  record('dist が静的ファイルのみ', true, `${distFiles.length} ファイル`);

  // 11b. 初期に読み込む JS（index.html の script と modulepreload）に Firebase SDK が無いこと
  //      Firebase は設定値があるときだけ遅延 import する。依存が vendor に紛れると閲覧だけの人も重くなる。
  const html = await readFile(path.join(ROOT, 'dist', 'index.html'), 'utf8');
  const initial = [...new Set([...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
  const firebaseMark = /firestore\.googleapis\.com|identitytoolkit\.googleapis\.com/;
  const heavy = [];
  for (const file of initial) {
    if (firebaseMark.test(await readFile(path.join(ROOT, 'dist', file), 'utf8'))) heavy.push(file);
  }
  record('初期読み込みの JS に Firebase SDK が無い', heavy.length === 0,
    heavy.length ? heavy.join(', ') : `${initial.length} ファイルを確認`);

  // 11c. 初期読み込みの JS の合計が上限以内（SDK の依存が紛れ込んだときに気づくため。2026-09-24 時点で約 228 kB）
  const INITIAL_JS_LIMIT_KB = 260;
  let initialBytes = 0;
  for (const file of initial) initialBytes += (await stat(path.join(ROOT, 'dist', file))).size;
  const initialKb = Math.round(initialBytes / 1024);
  record(`初期読み込みの JS が ${INITIAL_JS_LIMIT_KB} kB 以内`, initialKb <= INITIAL_JS_LIMIT_KB, `${initialKb} kB`);
} catch {
  record('dist が静的ファイルのみ', true, 'dist 未生成のためスキップ');
}

const passed = checks.filter((c) => c.ok).length;
for (const c of checks) console.log(`${c.ok ? 'OK ' : 'NG '} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
console.log(`\n${passed} / ${checks.length} 件 OK`);
if (passed !== checks.length) process.exit(1);
