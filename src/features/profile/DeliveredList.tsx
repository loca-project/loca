/**
 * 自分の撮影リクエストに届いた動画（T43・ADR 0028）。自分の投稿の「撮影リクエスト」タブの上に出す。
 * 「受け取る」でリクエストを閉じ（熱量が戻る）、その動画の炎に熱量を足す。受け取るまでは地図に残り、ほかの人も応えられる。
 */

import React from 'react';
import type { MarkerData } from '@/core/types';
import type { DeliveredAnswer } from '@/core/logic/answers';
import { interpolate } from '@/core/logic/format';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import { publishLocalChange } from '@/shared/localChanges';

interface DeliveredListProps {
  delivered: DeliveredAnswer[];
  /** 「動画を見る」（地図でそのマーカーを開く） */
  onWatch: (marker: MarkerData) => void;
}

export default function DeliveredList({ delivered, onWatch }: DeliveredListProps) {
  const { requestStore } = useServices();
  const { t } = useI18n();
  const at = t.answers;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  if (delivered.length === 0) return null;

  const receive = (row: DeliveredAnswer, marker: MarkerData) => {
    if (!requestStore || !marker.ownerUid) return;
    const title = marker.title ?? marker.youtubeUrl;
    if (!window.confirm(interpolate(at.confirmReceive, { title, heat: row.entry.heat }))) return;
    void exclusive(async () => {
      try {
        await requestStore.receive({ id: row.entry.id, heat: row.entry.heat }, { id: marker.id, ownerUid: marker.ownerUid! });
        // 購読を待たずに、地図と一覧からこのリクエストを外す
        publishLocalChange({ kind: 'requestEntries', ids: [row.entry.id] });
        toast.success(interpolate(at.received, { heat: row.entry.heat }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const place = (row: DeliveredAnswer) => [row.spot.prefecture, row.spot.city].filter(Boolean).join(' ') || '-';
  return (
    <section className="mb-4 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
      <h3 className="mb-2 text-xs font-bold text-orange-800">
        <i className="fa-solid fa-fire mr-1.5" />
        {at.heading}
      </h3>
      <ul className="space-y-2">
        {delivered.map((row) =>
          row.markers.map((marker) => (
            <li key={`${row.entry.id}-${marker.id}`} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-gray-800">
                  {interpolate(at.row, { title: marker.title ?? marker.youtubeUrl, by: marker.createdBy })}
                </span>
                <span className="text-[11px] text-gray-500">
                  {place(row)} ・ {interpolate(t.myPosts.heat, { heat: row.entry.heat, count: 1 })}
                </span>
              </span>
              <button type="button" onClick={() => onWatch(marker)} className="rounded border border-gray-300 px-2 py-1">
                {at.watch}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => receive(row, marker)}
                className="rounded bg-orange-600 px-2 py-1 font-bold text-white disabled:opacity-40"
              >
                {at.receive}
              </button>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}
