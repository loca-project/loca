/**
 * rules/*.rules を名前順につないで firestore.rules を作る（ADR 0020）。
 * Firestore のルールは 1 ファイルしか反映できないため、部品に分けて書き、反映する形はここで作る。
 *
 *   node scripts/build-rules.mjs          firestore.rules を書き出す
 *   node scripts/build-rules.mjs --check  部品と食い違っていたら終了コード 1（verify が使う）
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = path.join(ROOT, 'rules');
const OUT = path.join(ROOT, 'firestore.rules');

/** 部品から firestore.rules の中身を作る。部品の間は空行 1 つ。 */
export async function buildRules() {
  const names = (await readdir(PARTS)).filter((n) => n.endsWith('.rules')).sort();
  if (names.length === 0) throw new Error(`部品がありません: ${PARTS}`);
  const bodies = await Promise.all(
    names.map(async (n) => (await readFile(path.join(PARTS, n), 'utf8')).replace(/\r\n/g, '\n').replace(/\n+$/, '\n')),
  );
  return { names, text: bodies.join('\n') };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { names, text } = await buildRules();
  if (process.argv.includes('--check')) {
    const current = (await readFile(OUT, 'utf8').catch(() => '')).replace(/\r\n/g, '\n');
    if (current !== text) {
      console.error('NG: firestore.rules が rules/ と食い違っています。npm run rules:build で作り直してください');
      process.exit(1);
    }
    console.log(`OK: firestore.rules は rules/ の ${names.length} 部品と一致`);
  } else {
    await writeFile(OUT, text);
    console.log(`firestore.rules を ${names.length} 部品から作りました（${text.split('\n').length - 1} 行）`);
  }
}
