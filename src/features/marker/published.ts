/**
 * YouTube への投稿日の表示。値は毎晩 Actions が YouTube Data API で取る（ADR 0017）。
 * 登録直後はまだ無いので、Loca への登録日と取り違えないよう案内を出す。
 */

import type { MarkerData } from '@/core/types';
import { formatDate } from '@/core/logic/format';
import type { Dictionary } from '@/i18n';

export function publishedLabel(marker: MarkerData, t: Dictionary): string {
  const at = marker.youtube?.publishedAt;
  return at ? formatDate(at) : t.details.publishedPending;
}
