import type { ReportReason } from '@/core/types';

/** 通報理由の選択肢（要件 3.8）。文言は i18n 側に持つ。 */
export const REPORT_REASONS: { id: ReportReason; labelKey: string }[] = [
  { id: 'copyright', labelKey: 'reportCopyright' },
  { id: 'illegal', labelKey: 'reportIllegal' },
  { id: 'misleading_location', labelKey: 'reportLocation' },
  { id: 'disinformation', labelKey: 'reportFalse' },
  { id: 'harassment', labelKey: 'reportHarassment' },
];
