/** 通報・ログ・アクセス制限など、運用まわりのドメイン型。 */

export type ReportReason =
  | 'copyright'
  | 'illegal'
  | 'misleading_location'
  | 'disinformation'
  | 'harassment';

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
