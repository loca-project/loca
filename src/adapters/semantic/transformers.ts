/**
 * transformers.js（ONNX Runtime Web）で埋め込みモデルをブラウザで動かす AI 検索のアダプタ（ADR 0033）。
 *
 * - モデルは AI 検索を使ったときに初めて読む。初期読み込みの JS には入れない（この部品ごと遅延 import する）
 * - モデルのファイルは Hugging Face から取り、ブラウザのキャッシュ（Cache Storage）に残して 2 回目から使い回す
 * - モデルは models.ts の設定 1 件で決まる。ここは設定どおりに動かすだけ
 */

import type { LoadProgress, SemanticPort } from '@/ports/semantic';
import { UpstreamError } from '@/ports';
import type { ModelConfig } from './models';
// ONNX Runtime の本体は自サイト（GitHub Pages）から配る。既定では cdn.jsdelivr.net から読んでいた（2026-09-26 実測）
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';

type Embed = (texts: string[]) => Promise<number[][]>;

export function createTransformersSemantic(config: ModelConfig): SemanticPort {
  let loading: Promise<Embed> | null = null;

  async function build(onProgress?: LoadProgress): Promise<Embed> {
    const tf = await import('@huggingface/transformers');
    tf.env.allowLocalModels = false;
    tf.env.useBrowserCache = true;
    // 相対の URL は読み込む側のファイルの場所で解決されてずれるので、ページの場所から絶対の URL にする
    const onnx = tf.env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
    if (onnx.wasm) onnx.wasm.wasmPaths = { mjs: new URL(ortMjs, document.baseURI).href, wasm: new URL(ortWasm, document.baseURI).href };
    // ファイルごとの進み具合を合計して 0〜1 にする
    const files = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      const sum = [...files.values()].reduce((a, f) => ({ loaded: a.loaded + f.loaded, total: a.total + f.total }), { loaded: 0, total: 0 });
      onProgress?.(sum.total ? sum.loaded / sum.total : null);
    };
    if (config.pooling === 'sentence_embedding') {
      const tokenizer = await tf.AutoTokenizer.from_pretrained(config.repo, { progress_callback });
      const model = await tf.AutoModel.from_pretrained(config.repo, {
        dtype: config.dtype as never,
        model_file_name: config.modelFileName,
        progress_callback,
      });
      return async (texts) => {
        const out = await model(tokenizer(texts, { padding: true, truncation: true }));
        return out.sentence_embedding.normalize(2, -1).tolist() as number[][];
      };
    }
    const extractor = await tf.pipeline('feature-extraction', config.repo, {
      dtype: config.dtype as never,
      model_file_name: config.modelFileName,
      progress_callback,
    });
    return async (texts) =>
      (await extractor(texts, { pooling: config.pooling as 'mean' | 'cls', normalize: true })).tolist() as number[][];
  }

  function ready(onProgress?: LoadProgress): Promise<Embed> {
    loading ??= build(onProgress).catch((e) => {
      loading = null; // 失敗を覚えたままにしない。次の検索で取り直す
      throw new UpstreamError('AI 検索のモデルを読み込めませんでした。通信状況を確かめて、もう一度試してください。', e);
    });
    return loading;
  }

  return {
    model: { id: config.id, sizeMb: config.sizeMb, rule: config.rule },
    async load(onProgress) {
      await ready(onProgress);
    },
    async embedQuery(text) {
      const [v] = await (await ready())([config.queryPrefix + text]);
      return v;
    },
    async embedDocuments(texts) {
      return (await ready())(texts.map((t) => config.documentPrefix + t));
    },
  };
}
