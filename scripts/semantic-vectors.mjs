/**
 * Edge AI のタグの説明文の埋め込みを前もって計算し、public/data/semantic-tags.json に書く（ADR 0033・T101）。
 * 端末では検索語の埋め込みだけを計算する（スマホで 26 件の説明文を計算すると「準備中 100%」のまま止まった。2026-09-26）。
 *
 *   npm run semantic:vectors
 *
 * タグの説明文（tagDescriptions.ts）か使うモデル（models.ts の ACTIVE_MODEL）を変えたら流し直す。
 * 画面は、ファイルのモデルと説明文の指紋が今のものと違えば使わず、端末で計算し直す。tests/core が食い違いを検出する。
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEmbedder, withAppModules } from './lib/semantic-node.mjs';

await withAppModules(async ({ MODELS, ACTIVE_MODEL, TAG_DESCRIPTIONS, tagDocument, descriptionsFingerprint }) => {
  const config = MODELS[ACTIVE_MODEL];
  const embed = await loadEmbedder(config);
  const keys = Object.keys(TAG_DESCRIPTIONS);
  const vectors = await embed(keys.map((k) => config.documentPrefix + tagDocument(k)));
  // 小数 5 桁に丸める（近さの計算には十分。ファイルを小さくする）
  const rounded = vectors.map((v) => v.map((x) => Math.round(x * 1e5) / 1e5));
  const body = {
    model: config.id,
    fingerprint: descriptionsFingerprint(),
    keys,
    vectors: rounded,
  };
  const file = path.join(process.cwd(), 'public', 'data', 'semantic-tags.json');
  await writeFile(file, `${JSON.stringify(body)}\n`);
  console.log(`OK  ${keys.length} 件のタグの埋め込み（${vectors[0].length} 次元・モデル ${config.id}）を ${path.relative(process.cwd(), file)} に書きました`);
});
