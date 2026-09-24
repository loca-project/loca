/**
 * 自分の投稿（T53）。右上のメニューの「自分の投稿」から開く。
 * 統計とエクスポート（要件 5.2）と同じ形の画面で、タブは「投稿一覧・統計・エクスポート」。対象はどれも自分の投稿だけ
 * （サイト全体の統計とエクスポートは管理者画面。T27）。
 * 投稿一覧はマーカーと撮影リクエストを切り替えて出し、押すと地図がその地点へ移って詳細が開く。
 * データは地図の一覧から本人の uid で絞る（myPosts.ts）。Firestore の読み取りは増えない。
 */

import React, { useMemo, useState } from 'react';
import type { MarkerData, RequestMarkerData } from '@/core/types';
import { myMarkers, myRequestSpots } from '@/core/logic/myPosts';
import { formatDate, interpolate } from '@/core/logic/format';
import { tagLabel } from '@/core/constants';
import Modal from '@/shared/components/Modal';
import DashboardTabs from '@/shared/components/DashboardTabs';
import { Segmented } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import StatisticsTab from '@/features/admin/StatisticsTab';
import ExportTab from '@/features/admin/ExportTab';

interface MyPostsModalProps {
  open: boolean;
  uid: string;
  markers: MarkerData[];
  requestMarkers: RequestMarkerData[];
  onPickMarker: (marker: MarkerData) => void;
  onPickRequest: (spot: RequestMarkerData) => void;
  onClose: () => void;
}

type Kind = 'markers' | 'requests';
type TabId = 'posts' | 'statistics' | 'export';

function PostRow({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b border-gray-50 px-1 py-2.5 text-left hover:bg-gray-50"
      >
        <span className="min-w-0 grow">
          <span className="block truncate text-xs font-bold text-gray-800">{title}</span>
          <span className="block truncate text-[11px] text-gray-500">{sub}</span>
        </span>
        <i className="fa-solid fa-location-arrow shrink-0 text-[11px] text-gray-300" />
      </button>
    </li>
  );
}

export default function MyPostsModal(props: MyPostsModalProps) {
  const { open, uid, markers, requestMarkers, onPickMarker, onPickRequest, onClose } = props;
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<TabId>('posts');
  const [kind, setKind] = useState<Kind>('markers');
  const mine = useMemo(() => myMarkers(markers, uid), [markers, uid]);
  const spots = useMemo(() => myRequestSpots(requestMarkers, uid), [requestMarkers, uid]);
  const place = (p: { prefecture?: string; city?: string }) => [p.prefecture, p.city].filter(Boolean).join(' ') || '-';

  const markerList = mine.map((m) => (
    <PostRow
      key={m.id}
      title={m.title ?? m.youtubeUrl}
      sub={`${place(m)} ・ ${tagLabel(m.tags?.mood, lang) || '-'} ・ ${t.details.registeredAt} ${formatDate(m.createdAt)}`}
      onClick={() => onPickMarker(m)}
    />
  ));
  const requestList = spots.map((r) => (
    <PostRow
      key={r.spot.id}
      title={place(r.spot)}
      sub={`${interpolate(t.myPosts.heat, { heat: r.heat, count: r.count })} ・ ${formatDate(r.latestAt)}`}
      onClick={() => onPickRequest(r.spot)}
    />
  ));
  const list = kind === 'markers' ? markerList : requestList;

  const postsTab = (
    <>
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'markers', label: interpolate(t.myPosts.markers, { count: mine.length }) },
          { value: 'requests', label: interpolate(t.myPosts.requests, { count: spots.length }) },
        ]}
      />
      {list.length > 0 ? (
        <>
          <p className="mb-1 mt-3 text-[11px] text-gray-400">{t.myPosts.hint}</p>
          <ul>{list}</ul>
        </>
      ) : (
        <p className="mt-6 text-center text-xs text-gray-500">
          {kind === 'markers' ? t.myPosts.emptyMarkers : t.myPosts.emptyRequests}
        </p>
      )}
    </>
  );

  // 統計とエクスポート（要件 5.2）と同じ大きな画面・同じタブの形。対象は自分のマーカーだけ
  return (
    <Modal open={open} title={t.myPosts.title} size="lg" onClose={onClose}>
      <DashboardTabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'posts', icon: 'fa-list-ul', label: t.myPosts.tabPosts },
          { id: 'statistics', icon: 'fa-chart-pie', label: t.admin.tabStatistics },
          { id: 'export', icon: 'fa-file-export', label: t.admin.tabExport },
        ]}
      />
      <div className="min-h-[20rem]">
        {tab === 'posts' && postsTab}
        {tab === 'statistics' && <StatisticsTab markers={mine} />}
        {tab === 'export' && <ExportTab markers={mine} filePrefix="loca-my-markers" />}
      </div>
    </Modal>
  );
}
