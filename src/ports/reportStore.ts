import type { ReportReason } from '@/core/types';
import type { Adapter } from './common';

export interface ReportInput {
  markerId: string;
  /** 1 つ以上。要件 3.8 の 5 種 */
  reasons: ReportReason[];
  /** 任意。1000 字まで */
  detail: string;
}

/**
 * 通報の書き込みポート（要件 3.8）。1 人 1 マーカー 1 件で、読めるのは管理者と本人（ルールで守る）。
 * 通報されたマーカーは、管理者が対応するまで表示されたまま。
 */
export interface ReportStorePort extends Adapter {
  /** 'created' は通報した、'already' は同じマーカーをすでに通報済み。未ログインは UpstreamError。 */
  submit(input: ReportInput): Promise<'created' | 'already'>;
}