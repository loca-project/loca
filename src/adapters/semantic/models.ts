/**
 * AI 検索の埋め込みモデルの設定（ADR 0033）。**モデルを差し替えるときは、ここに 1 件足して ACTIVE_MODEL を変えるだけ。**
 *
 * 差し替えの手順:
 * 1. Hugging Face で ONNX 版（transformers.js 用）があるモデルを選ぶ。日本語と英語の両方に対応していること
 * 2. 下の MODELS に 1 件足す（前置き・文の数値の取り出し方はモデルの説明ページのとおりに）
 * 3. `npm run semantic:eval -- <名前>` で採点し、日本語・英語の正解率と、下限（minTop）・幅（margin）を決める
 * 4. ACTIVE_MODEL を変え、ADR 0033 の表に結果を足す
 * 採点の問題は scripts/data/semantic-cases.json（日本語と英語を同数）。
 */

import type { EmbeddingModelInfo } from '@/ports/semantic';

export interface ModelConfig extends EmbeddingModelInfo {
  /** Hugging Face のリポジトリ */
  repo: string;
  /** 読み込む ONNX の精度（transformers.js の dtype。'q4'・'q8'・'fp16' など） */
  dtype: string;
  /**
   * ONNX のファイル名の頭（既定は 'model'）。ブラウザの WebAssembly 版の ONNX Runtime に無い処理を使うモデルは、
   * それを使わない版を選ぶ（EmbeddingGemma の 4 ビット版は GatherBlockQuantized が無く、model_no_gather を使う。2026-09-26）
   */
  modelFileName?: string;
  /**
   * 文の数値の取り出し方。
   * - 'sentence_embedding': モデルが文のベクトルを直接返す（EmbeddingGemma など）
   * - 'mean' / 'cls': トークンのベクトルを平均する・先頭を使う（feature-extraction の pipeline）
   */
  pooling: 'sentence_embedding' | 'mean' | 'cls';
  /** 検索語・文書の前に付ける指示（モデルの説明ページのとおり） */
  queryPrefix: string;
  documentPrefix: string;
}

export const MODELS: Record<string, ModelConfig> = {
  /**
   * 2026-09-26 採点（77 の意味 × 日本語・英語、タグの説明つき。model_no_gather_q4 で）: 1 位の正解 日本語 94%・英語 72%（未使用の 32 問）。
   * 下限 0.27 で地名 25 語はすべて読み替えない。タグの検索語は 154 問中 97 問で読み替え、正解 94。
   * 幅 0.02 で「採ったタグに正解がある」94/97（97%）。ライセンスは Gemma の利用規約。
   */
  'embeddinggemma-300m-q4': {
    id: 'embeddinggemma-300m-q4',
    repo: 'onnx-community/embeddinggemma-300m-ONNX',
    dtype: 'q4',
    modelFileName: 'model_no_gather',
    // 初回に読む合計: モデル一式 約 217 MB（onnx_data 194.6 MB・tokenizer.json 20.3 MB ほか）＋ ONNX Runtime の .wasm 26.9 MB
    sizeMb: 240,
    pooling: 'sentence_embedding',
    queryPrefix: 'task: search result | query: ',
    documentPrefix: 'title: none | text: ',
    rule: { minTop: 0.27, margin: 0.02, maxTags: 3 },
  },
};

/** 使うモデル。差し替えはここを変える */
export const ACTIVE_MODEL = 'embeddinggemma-300m-q4';
