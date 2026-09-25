/**
 * 自分の投稿の「投稿動画」タブ（T53 改訂）。行ごとに地図へ・削除、チェックで選んで一括削除・書き出し。
 * 削除は論理削除（本人の論理削除は印なしで通る。ADR 0021）。消した行は差分の購読で一覧から外れる。
 */

import React, { useMemo } from 'react';
import type { MarkerData } from '@/core/types';
import { formatDate, interpolate } from '@/core/logic/format';
import { tagLabel } from '@/core/constants';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import { publishLocalChange } from '@/shared/localChanges';
import { MARKER_COLUMNS, markerExportRows, saveExport } from '@/features/admin/exportData';
import PostsToolbar, { useSelection } from './PostsToolbar';
import PostRow from './PostRow';

interface MyMarkersTabProps {
  mine: MarkerData[];
  /** 受け取ったいいね（マーカー ID → 件数。0 件は無い） */
  received: Record<string, number>;
  onJump: (marker: MarkerData) => void;
}

export default function MyMarkersTab({ mine, received, onJump }: MyMarkersTabProps) {
  const { markerStore } = useServices();
  const { t, lang } = useI18n();
  const mp = t.myPosts;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const ids = useMemo(() => mine.map((m) => m.id), [mine]);
  const selection = useSelection(ids);
  const place = (m: MarkerData) => [m.prefecture, m.city].filter(Boolean).join(' ') || '-';

  const remove = (targets: string[]) => {
    if (!markerStore || targets.length === 0) return;
    if (!window.confirm(interpolate(mp.confirmDeleteMarkers, { count: targets.length }))) return;
    void exclusive(async () => {
      try {
        const count = await markerStore.softDeleteMine(targets);
        // 購読を待たずに地図と一覧から外す（残ったままだと二重に削除できてしまう）
        publishLocalChange({ kind: 'markers', ids: targets });
        toast.success(interpolate(mp.deletedMarkers, { count }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const exportSelected = (format: 'csv' | 'json') => {
    const picked = mine.filter((m) => selection.selected.includes(m.id));
    saveExport('loca-my-markers', format, MARKER_COLUMNS, markerExportRows(picked));
  };

  if (mine.length === 0) return <p className="mt-6 text-center text-xs text-gray-500">{mp.emptyMarkers}</p>;

  return (
    <>
      <PostsToolbar
        total={mine.length}
        selectedCount={selection.selected.length}
        busy={loading}
        deleteLabel={mp.deleteSelected}
        onSelectAll={selection.setAll}
        onDelete={() => remove(selection.selected)}
        onExport={exportSelected}
      />
      <ul>
        {mine.map((m) => (
          <PostRow
            key={m.id}
            title={m.title ?? m.youtubeUrl}
            sub={`${place(m)} ・ ${tagLabel(m.tags?.mood, lang) || '-'} ・ ${t.details.registeredAt} ${formatDate(m.createdAt)}${
              received[m.id] ? ` ・ ${interpolate(t.likes.receivedRow, { count: received[m.id] })}` : ''
            }`}
            checked={selection.isPicked(m.id)}
            busy={loading}
            deleteLabel={mp.delete}
            onToggle={() => selection.toggle(m.id)}
            onJump={() => onJump(m)}
            onDelete={() => remove([m.id])}
          />
        ))}
      </ul>
    </>
  );
}
