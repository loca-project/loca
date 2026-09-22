/** 撮影リクエストマーカーの閲覧パネル。地点に集まった熱量と操作を並べる。 */

import React from 'react';
import type { RequestMarkerData } from '@/core/types';
import { formatCount } from '@/core/logic/format';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface RequestViewProps {
  marker: RequestMarkerData;
  onAddRequest: () => void;
  onPostVideo: () => void;
  onSearchRelated: () => void;
  onCancel: () => void;
}

export default function RequestView({
  marker,
  onAddRequest,
  onPostVideo,
  onSearchRelated,
  onCancel,
}: RequestViewProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-gray-900 p-4 text-center text-white">
        <p className="text-[11px] text-gray-300">{t.form.totalHeat}</p>
        <p className="text-2xl font-bold">
          <i className="fa-solid fa-fire mr-1.5 text-orange-400" />
          {formatCount(marker.totalHeat)}
        </p>
        <p className="mt-1 text-[11px] text-gray-400">{formatCount(marker.requestCount)} 件</p>
        {(marker.prefecture || marker.city) && (
          <p className="mt-1 text-[11px] text-gray-400">
            {[marker.prefecture, marker.city].filter(Boolean).join(' ')}
          </p>
        )}
      </div>

      <Button onClick={onAddRequest}>
        <i className="fa-solid fa-fire mr-1.5" />
        {t.form.addRequest}
      </Button>

      <Button variant="secondary" onClick={onPostVideo}>
        <i className="fa-brands fa-youtube mr-1.5" />
        {t.form.postVideo}
      </Button>

      <Button variant="secondary" onClick={onSearchRelated}>
        <i className="fa-solid fa-magnifying-glass mr-1.5" />
        {t.form.relatedVideos}
      </Button>

      <Button variant="ghost" onClick={onCancel}>
        {t.form.cancel}
      </Button>
    </div>
  );
}
