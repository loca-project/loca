/**
 * マーカー情報表示モード（要件 3.7）。
 * 編集は GitHub 上で行うため、ここは閲覧と通報の導線だけを持つ。
 */

import React from 'react';
import type { MarkerData } from '@/core/types';
import { formatDate } from '@/core/logic/format';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface MarkerDetailsProps {
  marker: MarkerData;
  onCancel: () => void;
  onShare: () => void;
  onReport: () => void;
  onWatch: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 py-1.5 text-[11px] last:border-0">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="break-all text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}

export default function MarkerDetails({
  marker,
  onCancel,
  onShare,
  onReport,
  onWatch,
}: MarkerDetailsProps) {
  const { t } = useI18n();
  const equipment = [marker.equipment?.manufacturer, marker.equipment?.series, marker.equipment?.model]
    .filter(Boolean)
    .join(' / ');

  return (
    <div className="flex flex-col gap-3">
      {marker.thumbnailUrl && (
        <button type="button" onClick={onWatch} className="overflow-hidden rounded" title={t.details.watchHere}>
          <img src={marker.thumbnailUrl} alt="" className="w-full object-cover" />
        </button>
      )}
      <p className="text-xs font-bold leading-snug text-gray-800">{marker.title ?? '-'}</p>

      <dl>
        <Row label={t.details.channel} value={marker.channelTitle ?? '-'} />
        <Row label={t.filters.prefecture} value={`${marker.prefecture ?? '-'} ${marker.city ?? ''}`} />
        <Row label={t.filters.tagAction} value={marker.tags?.action ?? '-'} />
        <Row label={t.filters.tagAtmosphere} value={marker.tags?.atmosphere ?? '-'} />
        <Row label={t.filters.tagEmotion} value={marker.tags?.emotion ?? '-'} />
        <Row label={t.form.equipment} value={equipment || '-'} />
        <Row label={t.details.registeredAt} value={formatDate(marker.createdAt)} />
        <Row label={t.details.contributor} value={marker.createdBy || '-'} />
        <Row label={t.form.lat} value={marker.lat.toFixed(6)} />
        <Row label={t.form.lng} value={marker.lng.toFixed(6)} />
      </dl>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onShare}>
          <i className="fa-solid fa-share-nodes mr-1.5" />
          {t.actions.share}
        </Button>
        <Button variant="secondary" onClick={onReport} title={t.actions.report}>
          <i className="fa-solid fa-flag" />
        </Button>
      </div>

      <a
        href={marker.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded bg-red-600 py-2 text-center text-xs font-bold text-white hover:bg-red-700"
      >
        <i className="fa-brands fa-youtube mr-1.5" />
        {t.details.openYoutube}
      </a>

      <Button variant="ghost" onClick={onCancel}>
        {t.form.cancel}
      </Button>
    </div>
  );
}
