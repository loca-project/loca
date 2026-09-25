/**
 * 自分の投稿（T53・2026-09-24 改訂）。右上のメニューの「自分の投稿」から開く。
 * 管理者モードと同じ形の大きな画面で、タブは左から「統計・投稿動画・撮影リクエスト」（対象はどれも自分の投稿だけ）。
 * 投稿動画と撮影リクエストのタブは、行ごとに地図へ・削除（取り下げ）、チェックで選んだものを一括削除・書き出しできる。
 * データは地図の一覧から本人の uid で絞る（myPosts.ts）。Firestore から読むのは、受け取ったいいねの件数だけ（ADR 0024）。
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { MarkerData, RequestMarkerData } from '@/core/types';
import { myMarkers, myRequestSpots } from '@/core/logic/myPosts';
import { interpolate } from '@/core/logic/format';
import Modal from '@/shared/components/Modal';
import DashboardTabs from '@/shared/components/DashboardTabs';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';
import StatisticsTab from '@/features/admin/StatisticsTab';
import MyMarkersTab from './MyMarkersTab';
import MyRequestsTab from './MyRequestsTab';

interface MyPostsModalProps {
  open: boolean;
  uid: string;
  markers: MarkerData[];
  requestMarkers: RequestMarkerData[];
  onPickMarker: (marker: MarkerData) => void;
  onPickRequest: (spot: RequestMarkerData) => void;
  onClose: () => void;
}

type TabId = 'statistics' | 'markers' | 'requests';

export default function MyPostsModal(props: MyPostsModalProps) {
  const { open, uid, markers, requestMarkers, onPickMarker, onPickRequest, onClose } = props;
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>('markers');
  const mine = useMemo(() => myMarkers(markers, uid), [markers, uid]);
  const spots = useMemo(() => myRequestSpots(requestMarkers, uid), [requestMarkers, uid]);
  const received = useReceivedLikes(open);
  // 合計は、いま地図にある自分のマーカーの分だけ（削除したマーカーの分は数えない）
  const receivedTotal = mine.reduce((sum, m) => sum + (received[m.id] ?? 0), 0);

  return (
    <Modal open={open} title={t.myPosts.title} size="lg" onClose={onClose}>
      <DashboardTabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'statistics', icon: 'fa-chart-pie', label: t.myPosts.tabStatistics },
          { id: 'markers', icon: 'fa-video', label: interpolate(t.myPosts.tabMarkers, { count: mine.length }) },
          { id: 'requests', icon: 'fa-hand', label: interpolate(t.myPosts.tabRequests, { count: spots.length }) },
        ]}
      />
      <div className="min-h-[20rem]">
        {tab === 'statistics' && (
          <>
            <p className="mb-3 text-xs font-bold text-pink-600">
              <i className="fa-solid fa-heart mr-1.5" />
              {interpolate(t.likes.received, { count: receivedTotal })}
            </p>
            <StatisticsTab markers={mine} />
          </>
        )}
        {tab === 'markers' && <MyMarkersTab mine={mine} received={received} onJump={onPickMarker} />}
        {tab === 'requests' && <MyRequestsTab uid={uid} spots={spots} onJump={onPickRequest} />}
      </div>
    </Modal>
  );
}

/** 自分のマーカーが受け取ったいいね（マーカー ID → 件数）。開いたときに 1 回読む。読めなければ空のまま。 */
function useReceivedLikes(open: boolean): Record<string, number> {
  const { likeStore } = useServices();
  const [received, setReceived] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!open || !likeStore) return undefined;
    let cancelled = false;
    likeStore
      .receivedByMine()
      .then((r) => {
        if (!cancelled) setReceived(r);
      })
      .catch((e: unknown) => console.warn('[loca] 受け取ったいいねを読めませんでした', e));
    return () => {
      cancelled = true;
    };
  }, [open, likeStore]);
  return received;
}
