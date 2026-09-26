/**
 * AI 検索のモデルを採点する（ADR 0033）。モデルを差し替えるときに、日本語・英語の正解率と、タグの採り方（下限・幅）を決める。
 *
 *   npm run semantic:eval                 使っているモデル（src/adapters/semantic/models.ts の ACTIVE_MODEL）
 *   npm run semantic:eval -- <名前>        models.ts の MODELS に足したモデル
 *
 * モデルの設定・タグの説明文・タグの採り方は、アプリと同じファイルを Vite で読む（二重に持たない）。
 * 問題は scripts/data/semantic-cases.json（日本語と英語が同数）。モデルは Hugging Face から取り、node_modules/.cache に置く。
 * Node の ONNX Runtime で動かす。ブラウザの WebAssembly 版に無い処理を使うモデルは、実ブラウザでも確かめる（/ui-check）。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = process.cwd();
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const { MODELS, ACTIVE_MODEL } = await vite.ssrLoadModule('/src/adapters/semantic/models.ts');
  const { TAG_DESCRIPTIONS, tagDocument } = await vite.ssrLoadModule('/src/core/constants/tagDescriptions.ts');
  const { rankTags, pickTags } = await vite.ssrLoadModule('/src/core/logic/semanticSearch.ts');
  const name = process.argv[2] ?? ACTIVE_MODEL;
  const config = MODELS[name];
  if (!config) {
    console.error(`NG: models.ts に「${name}」がありません（あるもの: ${Object.keys(MODELS).join(', ')}）`);
    process.exit(2);
  }
  const cases = JSON.parse(await readFile(path.join(ROOT, 'scripts', 'data', 'semantic-cases.json'), 'utf8'));

  const tf = await import('@huggingface/transformers');
  tf.env.cacheDir = path.join(ROOT, 'node_modules', '.cache', 'semantic-models');
  const opts = { dtype: config.dtype, model_file_name: config.modelFileName };
  let embed;
  if (config.pooling === 'sentence_embedding') {
    const tok = await tf.AutoTokenizer.from_pretrained(config.repo);
    const model = await tf.AutoModel.from_pretrained(config.repo, opts);
    embed = async (texts) => (await model(tok(texts, { padding: true, truncation: true }))).sentence_embedding.normalize(2, -1).tolist();
  } else {
    const ex = await tf.pipeline('feature-extraction', config.repo, opts);
    embed = async (texts) => (await ex(texts, { pooling: config.pooling, normalize: true })).tolist();
  }

  const keys = Object.keys(TAG_DESCRIPTIONS);
  const vectors = await embed(keys.map((k) => config.documentPrefix + tagDocument(k)));
  const tags = keys.map((key, i) => ({ key, field: TAG_DESCRIPTIONS[key].field, vector: vectors[i] }));
  const rank = async (q) => rankTags((await embed([config.queryPrefix + q]))[0], tags);

  const pct = (a, b) => `${a}/${b}（${b ? Math.round((a / b) * 100) : 0}%）`;
  console.log(`モデル: ${name}（${config.repo}・${config.dtype}${config.modelFileName ? `・${config.modelFileName}` : ''}）`);
  console.log(`採り方: 下限 ${config.rule.minTop}・幅 ${config.rule.margin}・最大 ${config.rule.maxTags}\n`);

  // 1. 1 位の正解率（言語ごと・問題の組ごと）
  const all = [];
  for (const set of ['tags', 'holdout']) {
    const line = [];
    for (const lang of ['ja', 'en']) {
      let ok = 0;
      for (const c of cases[set]) {
        const ranked = await rank(c[lang]);
        all.push({ ranked, ok: c.ok });
        ok += c.ok.includes(ranked[0].key);
      }
      line.push(`${lang === 'ja' ? '日本語' : '英語'} ${pct(ok, cases[set].length)}`);
    }
    console.log(`1 位の正解 ${set === 'holdout' ? '未使用の問題' : '調整に使った問題'}: ${line.join('・')}`);
  }

  // 2. いまの採り方での当たり・読み替えた数・地名を読み替えなかった数
  let used = 0; let hit = 0;
  for (const r of all) {
    const picked = pickTags(r.ranked, config.rule);
    if (picked.length) { used += 1; hit += picked.some((t) => r.ok.includes(t.key)); }
  }
  let placesSkipped = 0;
  const placeTops = [];
  for (const p of cases.places) {
    const ranked = await rank(p);
    placeTops.push(ranked[0].score);
    placesSkipped += pickTags(ranked, config.rule).length === 0;
  }
  console.log(`\nいまの採り方: タグの検索語 ${all.length} 問中 ${used} 問で読み替え、採ったタグに正解がある ${pct(hit, used)}`);
  console.log(`地名を読み替えない: ${pct(placesSkipped, cases.places.length)}（地名の 1 位の近さ 最大 ${Math.max(...placeTops).toFixed(3)}）`);

  // 3. 下限の候補（地名をすべて除ける最小の値の前後）
  console.log('\n下限の候補（読み替えた問題・そのうち正解・地名を除けた数）:');
  const base = Math.floor(Math.max(...placeTops) * 100) / 100;
  for (const t of [base - 0.02, base - 0.01, base, base + 0.01, base + 0.02].map((x) => Math.round(x * 100) / 100)) {
    const kept = all.filter((r) => r.ranked[0].score >= t);
    const good = kept.filter((r) => r.ok.includes(r.ranked[0].key)).length;
    console.log(`  ${t.toFixed(2)}: ${kept.length}/${all.length}・正解 ${good}・地名 ${placeTops.filter((s) => s < t).length}/${placeTops.length}`);
  }
  console.log('\n確かめ方: 未使用の問題の正解率を ADR 0033 の表と比べ、地名を読み替えないが 100% になる下限を models.ts に書く');
} finally {
  await vite.close();
}
