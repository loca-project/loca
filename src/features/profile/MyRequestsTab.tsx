/**
 * 自分の投稿の「撮影リクエスト」タブ（T53 改訂）。1 行が 1 地点（その地点に出した自分のリクエストをまとめる）。
 * 行ごとに地図へ・取り下げ、チェックで選んで一括取り下げ・書き出し。取り下げると熱量が戻る（論理削除。ADR 0013）。
 */

import React, { useMemo } from 'react';
import type { RequestMarkerData } from '@/core/types';
import type { MyRequestSpot } from '@/core/logic/myPosts';
import { formatDate, interpolate } from '@/core/logic/format';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import { publishLocalChange } from '@/shared/localChanges';
import { REQUEST_COLUMNS, requestExportRows, saveExport } from '@/features/admin/exportData';
import PostsToolbar, { useSelection } from './PostsToolbar';
import PostRow from './PostRow';

interface MyRequestsTabProps {
  uid: string;
  spots: MyRequestSpot[];
  onJump: (spot: RequestMarkerData) => void;
}

export default function MyRequestsTab({ uid, spots, onJump }: MyRequestsTabProps) {
  const { requestStore } = useServices();
  const { t } = useI18n();
  const mp = t.myPosts;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const ids = useMemo(() => spots.map((r) => r.spot.id), [spots]);
  const selection = useSelection(ids);
  const place = (s: RequestMarkerData) => [s.prefecture, s.city].filter(Boolean).join(' ') || '-';
  const picked = () => spots.filter((r) => selection.selected.includes(r.spot.id));

  /** 地点に出した自分のリクエストをすべて取り下げる（熱量の印は 1 件ずつしか動かせないので順に） */
  const withdraw = (targets: MyRequestSpot[]) => {
    if (!requestStore || targets.length === 0) return;
    if (!window.confirm(interpolate(mp.confirmWithdraw, { count: targets.length }))) return;
    void exclusive(async () => {
      const done: string[] = [];
      try {
        for (const r of targets) {
          for (const e of (r.spot.entries ?? []).filter((x) => x.ownerUid === uid)) {
            await requestStore.withdraw({ id: e.id, heat: e.heat });
            done.push(e.id);
          }
        }
        toast.success(interpolate(mp.withdrawn, { count: done.length }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        // 途中で止まっても、取り下げた分は購読を待たずに地図と一覧から外す
        publishLocalChange({ kind: 'requestEntries', ids: done });
      }
    });
  };

  const exportSelected = (format: 'csv' | 'json') => {
    saveExport('loca-my-requests', format, REQUEST_COLUMNS, requestExportRows(picked().map((r) => r.spot), uid));
  };

  if (spots.length === 0) return <p className="mt-6 text-center text-xs text-gray-500">{mp.emptyRequests}</p>;

  return (
    <>
      <PostsToolbar
        total={spots.length}
        selectedCount={selection.selected.length}
        busy={loading}
        deleteLabel={mp.withdrawSelected}
        onSelectAll={selection.setAll}
        onDelete={() => withdraw(picked())}
        onExport={exportSelected}
      />
      <ul>
        {spots.map((r) => (
          <PostRow
            key={r.spot.id}
            title={place(r.spot)}
            sub={`${interpolate(mp.heat, { heat: r.heat, count: r.count })} ・ ${formatDate(r.latestAt)}`}
            checked={selection.isPicked(r.spot.id)}
            busy={loading}
            deleteLabel={mp.withdraw}
            onToggle={() => selection.toggle(r.spot.id)}
            onJump={() => onJump(r.spot)}
            onDelete={() => withdraw([r])}
          />
        ))}
      </ul>
    </>
  );
}
