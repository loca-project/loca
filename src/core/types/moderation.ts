/** 通報・ログ・アクセス制限など、運用まわりのドメイン型。 */

export type ReportReason =
  | 'copyright'
  | 'illegal'
  | 'misleading_location'
  | 'disinformation'
  | 'harassment';

/** Firestore の reports/{markerId}_{uid} の 1 件（1 人 1 マーカー 1 件）。時刻は epoch ms。 */
export interface ReportRecord {
  markerId: string;
  reporterUid: string;
  reasons: ReportReason[];
  status: 'open' | 'resolved';
  updatedAt: number;
}

/** マーカーごとの通報の集計（管理者画面用）。人数は通報した人の数で、同じ人の再通報は数えない。 */
export interface ReportSummary {
  markerId: string;
  /** 通報した人数 */
  reporters: number;
  /** 確認待ちの人数 */
  open: number;
  /** 理由ごとの人数 */
  reasons: Partial<Record<ReportReason, number>>;
  /** 最後に通報（再通報を含む）された時刻 */
  latestAt: number;
}

export interface ReportData {
  id: string;
  markerId: string;
  markerTitle: string;
  youtubeUrl: string;
  /** 複数選択可。要件 3.8 に準拠 */
  reasons: ReportReason[];
  /** 任意の自由記述 */
  detail?: string;
  reportedBy: string;
  reportedAt: number;
  status: 'pending' | 'resolved';
}

export type SystemLogType =
  | 'auto-update'
  | 'system'
  | 'marker_create'
  | 'marker_update'
  | 'marker_delete'
  | 'report';

export interface SystemLog {
  id: string;
  type: SystemLogType;
  message: string;
  timestamp: number;
  markerId?: string;
  markerTitle?: string;
  actorId?: string;
  details?: Record<string, unknown>;
}

export interface BlockedIpData {
  id: string;
  /** IP アドレスまたは CIDR */
  ip: string;
  reason?: string;
  createdAt: number;
  createdBy: string;
}

export interface BackupMetadata {
  id: string;
  createdAt: number;
  markerCount: number;
  reason: string;
  sizeBytes?: number;
}

/** AI 品質判定の教師例。 */
export interface GoodExample {
  id: string;
  videoTitle: string;
  description: string;
  expectedAction: 'keep' | 'hold_for_review' | 'suggest_deletion';
  expectedTags: string;
  reasoning: string;
  createdAt: number;
}
