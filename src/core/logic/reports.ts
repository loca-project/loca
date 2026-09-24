/** 通報の集計（要件 3.8）。1 人 1 件で保存しているので、件数がそのまま通報した人数になる。 */

import type { ReportRecord, ReportSummary } from '@/core/types';

/** マーカーごとに人数・確認待ち・理由の内訳をまとめ、確認待ちの多い順（同じなら人数、新しい順）に並べる。 */
export function summarizeReports(records: ReportRecord[]): ReportSummary[] {
  const byMarker = new Map<string, ReportSummary>();
  for (const r of records) {
    const s = byMarker.get(r.markerId) ?? { markerId: r.markerId, reporters: 0, open: 0, reasons: {}, latestAt: 0 };
    s.reporters += 1;
    if (r.status === 'open') s.open += 1;
    for (const reason of new Set(r.reasons)) s.reasons[reason] = (s.reasons[reason] ?? 0) + 1;
    s.latestAt = Math.max(s.latestAt, r.updatedAt);
    byMarker.set(r.markerId, s);
  }
  return [...byMarker.values()].sort((a, b) => b.open - a.open || b.reporters - a.reporters || b.latestAt - a.latestAt);
}
