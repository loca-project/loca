import type { Adapter } from './common';

/** 定期処理の記録 1 件（Firestore の jobs/{id}。Actions が書く。ADR 0017・0021）。 */
export interface JobRecord {
  /** youtube-refresh・purge-deleted など */
  id: string;
  /** 最後に動いた日時（epoch ms。不明なら 0） */
  ranAt: number;
  /** 件数などの数値の項目 */
  values: Record<string, number>;
}

/**
 * 管理者モードのポート（要件 5・T27）。
 * ここでの判定は表示の切り替えにだけ使う。権限はセキュリティルール（admins/{uid}）が守る。
 */
export interface AdminStorePort extends Adapter {
  /** ログイン中の人が管理者か（admins/{uid} があるか）。未ログインなら false。 */
  amIAdmin(): Promise<boolean>;
  /** 定期処理の記録。管理者だけ（それ以外は UpstreamError）。 */
  jobs(): Promise<JobRecord[]>;
}
