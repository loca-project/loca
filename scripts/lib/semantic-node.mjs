/**
 * Edge AI の埋め込みモデルを Node で動かす（ADR 0033）。採点（semantic-eval.mjs）とタグの埋め込みの事前計算（semantic-vectors.mjs）が使う。
 * モデルの設定・タグの説明文・採り方は、アプリと同じファイルを Vite で読む（二重に持たない）。
 */

import path from 'node:path';
import { createServer } from 'vite';

/** アプリの TypeScript のモジュールを読み、終わったら close する */
export async function withAppModules(fn) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
  try {
    const models = await vite.ssrLoadModule('/src/adapters/semantic/models.ts');
    const tags = await vite.ssrLoadModule('/src/core/constants/tagDescriptions.ts');
    const logic = await vite.ssrLoadModule('/src/core/logic/semanticSearch.ts');
    return await fn({ ...models, ...tags, ...logic });
  } finally {
    await vite.close();
  }
}

/** 設定どおりにモデルを読み、文の配列 → 正規化済みのベクトルの配列を返す関数を作る */
export async function loadEmbedder(config) {
  const tf = await import('@huggingface/transformers');
  tf.env.cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'semantic-models');
  const opts = { dtype: config.dtype, model_file_name: config.modelFileName };
  if (config.pooling === 'sentence_embedding') {
    const tok = await tf.AutoTokenizer.from_pretrained(config.repo);
    const model = await tf.AutoModel.from_pretrained(config.repo, opts);
    return async (texts) => (await model(tok(texts, { padding: true, truncation: true }))).sentence_embedding.normalize(2, -1).tolist();
  }
  const ex = await tf.pipeline('feature-extraction', config.repo, opts);
  return async (texts) => (await ex(texts, { pooling: config.pooling, normalize: true })).tolist();
}
