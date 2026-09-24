/**
 * 管理者モード（要件 5・T27）。右上のメニューの「管理者モード」から開く（admins/{uid} がある人だけに出す）。
 *
 * タブ（要件 5.1 の順）: 統計分析・データエクスポート（5.2.1・5.2.2）、ログ一覧（5.2.3・T60）、ユーザー管理（5.2.4・T59）、
 * マーカー管理（5.2.5・T60）、通報（3.8・T61）、定期処理（jobs の記録）。
 * 利用者向けは「自分の投稿」（自分の分だけの統計とエクスポート）。タブの見た目は DashboardTabs で共有する。
 * 画面の判定は表示の切り替えにだけ使い、権限はルールが守る。
 */

import React, { useState } from 'react';
import type { MarkerData } from '@/core/types';
import Modal from '@/shared/components/Modal';
import DashboardTabs from '@/shared/components/DashboardTabs';
import { useI18n } from '@/shared/hooks/useI18n';
import StatisticsTab from './StatisticsTab';
import ExportTab from './ExportTab';
import JobsTab from './JobsTab';
import UsersTab from './UsersTab';
import MarkersTab from './MarkersTab';
import LogsTab from './LogsTab';
import ReportsTab from './ReportsTab';

type TabId = 'statistics' | 'export' | 'logs' | 'users' | 'markers' | 'reports' | 'jobs';

interface AdminDashboardProps {
  open: boolean;
  markers: MarkerData[];
  onClose: () => void;
  /** マーカー管理の「地図へジャンプ」（管理者モードを閉じて地図を移す） */
  onJump: (marker: MarkerData) => void;
}

export default function AdminDashboard({ open, markers, onClose, onJump }: AdminDashboardProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>('statistics');

  return (
    <Modal open={open} title={t.admin.mode} size="lg" onClose={onClose}>
      <DashboardTabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'statistics', icon: 'fa-chart-pie', label: t.admin.tabStatistics },
          { id: 'export', icon: 'fa-file-export', label: t.admin.tabExport },
          { id: 'logs', icon: 'fa-scroll', label: t.admin.tabLogs },
          { id: 'users', icon: 'fa-users-gear', label: t.admin.tabUsers },
          { id: 'markers', icon: 'fa-location-dot', label: t.admin.tabMarkers },
          { id: 'reports', icon: 'fa-flag', label: t.admin.tabReports },
          { id: 'jobs', icon: 'fa-clock-rotate-left', label: t.admin.tabJobs },
        ]}
      />
      <div className="min-h-[20rem]">
        {tab === 'statistics' && <StatisticsTab markers={markers} />}
        {tab === 'export' && <ExportTab markers={markers} />}
        {tab === 'logs' && <LogsTab markers={markers} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'markers' && <MarkersTab markers={markers} onJump={onJump} />}
        {tab === 'reports' && <ReportsTab markers={markers} onJump={onJump} />}
        {tab === 'jobs' && <JobsTab />}
      </div>
    </Modal>
  );
}
