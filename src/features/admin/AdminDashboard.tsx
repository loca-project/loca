/**
 * 統計とエクスポート。
 *
 * データベースを持たないため、扱うのは公開済みの markers.json だけ。
 * 認証も無いので閲覧は誰でもできるが、見えるのは公開データの集計に限られる。
 */

import React, { useState } from 'react';
import type { MarkerData } from '@/core/types';
import Modal from '@/shared/components/Modal';
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

  const tabs: { id: TabId; icon: string; label: string }[] = [
    { id: 'statistics', icon: 'fa-chart-pie', label: t.admin.tabStatistics },
    { id: 'export', icon: 'fa-file-export', label: t.admin.tabExport },
  ];

  return (
    <Modal open={open} title={t.admin.title} size="lg" onClose={onClose}>
      <nav className="mb-4 flex flex-wrap gap-1 border-b border-gray-100 pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded px-3 py-1.5 text-[11px] font-bold transition ${
              tab === item.id ? 'bg-loca-500 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <i className={`fa-solid ${item.icon} mr-1.5`} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-h-[20rem]">
        {tab === 'statistics' && <StatisticsTab markers={markers} />}
        {tab === 'export' && <ExportTab markers={markers} />}
      </div>
    </Modal>
  );
}
