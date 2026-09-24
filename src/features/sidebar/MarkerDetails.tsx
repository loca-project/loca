/**
 * マーカー情報表示モード（要件 3.7）。
 * 登録した本人にだけ「編集」「削除」を出す（要件 3.x。判定は表示用で、権限はルールが守る）。
 */

import React from 'react';
import type { MarkerData } from '@/core/types';
import { formatCount, formatDate, formatDuration } from '@/core/logic/format';
import { TAG_FIELDS, tagLabel } from '@/core/constants';
import { Button, LinkButton } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface MarkerDetailsProps {
  marker: MarkerData;
  onCancel: () => void;
  onShare: () => void;
  onReport: () => void;
  onWatch: () => void;
  /** 本人のマーカーのときだけ渡す */
  onEdit?: () => void;
  onDelete?: () => void;
  busy?: boolean;
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
  onEdit,
  onDelete,
  busy = false,
}: MarkerDetailsProps) {
  const { t, lang } = useI18n();
  const equipment = [marker.equipment?.manufacturer, marker.equipment?.series, marker.equipment?.model]
    .filter(Boolean)
    .join(' / ');

  // 並びは利用者の動線の順: 見る（動画）→ 共有・通報 → 知る（詳細）→ 自分の操作 → 閉じる
  return (
    <div className="flex flex-col gap-3">
      {marker.thumbnailUrl && (
        <button type="button" onClick={onWatch} className="overflow-hidden rounded-md" title={t.details.watchHere}>
          <img src={marker.thumbnailUrl} alt="" className="w-full object-cover" />
        </button>
      )}
      <div>
        <p className="text-xs font-bold leading-snug text-gray-800">{marker.title ?? '-'}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">{marker.channelTitle ?? '-'}</p>
      </div>

      <LinkButton variant="danger" href={marker.youtubeUrl} target="_blank" rel="noopener noreferrer">
        <i className="fa-brands fa-youtube mr-1.5" />
        {t.details.openYoutube}
      </LinkButton>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onShare}>
          <i className="fa-solid fa-share-nodes mr-1.5" />
          {t.actions.share}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onReport}>
          <i className="fa-solid fa-flag mr-1.5" />
          {t.actions.report}
        </Button>
      </div>

      <dl>
        <Row label={t.filters.prefecture} value={`${marker.prefecture ?? '-'} ${marker.city ?? ''}`} />
        {TAG_FIELDS.map((field) => (
          <Row key={field} label={t.tags[field]} value={tagLabel(marker.tags?.[field], lang) || '-'} />
        ))}
        {marker.memo && <Row label={t.tags.memo} value={marker.memo} />}
        <Row label={t.form.equipment} value={equipment || '-'} />
        {/* 再生数などは毎晩 Actions が取る（ADR 0017）。まだ無ければ案内だけ出す */}
        {marker.youtube ? (
          <>
            <Row label={t.details.views} value={formatCount(marker.youtube.viewCount)} />
            <Row label={t.details.publishedAt} value={formatDate(marker.youtube.publishedAt)} />
            <Row label={t.details.duration} value={formatDuration(marker.youtube.durationSec)} />
          </>
        ) : (
          <Row label={t.details.views} value={t.details.statsPending} />
        )}
        <Row label={t.details.registeredAt} value={formatDate(marker.createdAt)} />
        <Row label={t.details.contributor} value={marker.createdBy || '-'} />
        <Row label={t.form.lat} value={marker.lat.toFixed(6)} />
        <Row label={t.form.lng} value={marker.lng.toFixed(6)} />
      </dl>

      {onEdit && onDelete && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onEdit} disabled={busy}>
            <i className="fa-solid fa-pen mr-1.5" />
            {t.store.edit}
          </Button>
          <Button variant="secondary" className="flex-1 text-red-600" onClick={onDelete} disabled={busy}>
            <i className="fa-solid fa-trash mr-1.5" />
            {t.store.delete}
          </Button>
        </div>
      )}

      <Button variant="ghost" onClick={onCancel}>
        {t.close}
      </Button>
    </div>
  );
}