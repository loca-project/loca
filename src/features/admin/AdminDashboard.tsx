/**
 * サイト全体の統計とエクスポート（要件 5.2）。
 *
 * もとは管理者モードのタブ。ログインを持たなかった間（2026-09-22〜）は誰でも開けたが、
 * 利用者向けは「自分の投稿」（自分の分だけの統計とエクスポート）にまとめたので、公開の入口は外した。
 * 管理者画面（T27）から開く。
 */

import React, { useState } from 'react';
import type { MarkerData } from '@/core/types';
import Modal from '@/shared/components/Modal';
import DashboardTabs from '@/shared/components/DashboardTabs';
import { useI18n } from '@/shared/hooks/useI18n';
import StatisticsTab from './StatisticsTab';
import ExportTab from './ExportTab';

type TabId = 'statistics' | 'export';

interface AdminDashboardProps {
  open: boolean;
  markers: MarkerData[];
  onClose: () => void;
}

export default function AdminDashboard({ open, markers, onClose }: AdminDashboardProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>('statistics');

  return (
    <Modal open={open} title={t.admin.title} size="lg" onClose={onClose}>
      <DashboardTabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'statistics', icon: 'fa-chart-pie', label: t.admin.tabStatistics },
          { id: 'export', icon: 'fa-file-export', label: t.admin.tabExport },
        ]}
      />
      <div className="min-h-[20rem]">
        {tab === 'statistics' && <StatisticsTab markers={markers} />}
        {tab === 'export' && <ExportTab markers={markers} />}
      </div>
    </Modal>
  );
}
