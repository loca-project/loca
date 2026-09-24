import type { ReportReason, ReportSummary } from '@/core/types';
import type { Adapter } from './common';

export interface ReportInput {
  markerId: string;
  /** 1 つ以上。要件 3.8 の 5 種 */
  reasons: ReportReason[];
  /** 任意。1000 字まで */
  detail: string;
}

/**
 * 通報のポート（要件 3.8）。1 人 1 マーカー 1 件で、読めるのは管理者と本人（ルールで守る）。
 * 件数は通報した人数として数える。通報されたマーカーは、管理者が対応するまで表示されたまま。
 */
export interface ReportStorePort extends Adapter {
  /**
   * 'created' は新しく通報した、'updated' は同じマーカーへの 2 回目で理由と詳細を置き換えた（確認待ちに戻る）。
   * 未ログインは UpstreamError。
   */
  submit(input: ReportInput): Promise<'created' | 'updated'>;
  /** マーカーごとの集計。管理者だけ（それ以外は UpstreamError）。 */
  summaries(): Promise<ReportSummary[]>;
  /** マーカーへの確認待ちの通報をすべて対応済みにする。管理者だけ（T61）。対応済みにした件数を返す。 */
  resolve(markerId: string): Promise<number>;
}
