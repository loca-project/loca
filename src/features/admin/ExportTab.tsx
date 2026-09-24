/**
 * データエクスポート（要件 5.2.2）。管理者モードで、サイト全体のマーカーを書き出す。
 * 出力対象は Youtube URL・タグ・現地メモ。組み立ては exportData.ts（自分の投稿の書き出しと共有）。
 */

import React, { useMemo } from 'react';
import type { MarkerData } from '@/core/types';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { MARKER_COLUMNS, markerExportRows, saveExport } from './exportData';

export default function ExportTab({ markers }: { markers: MarkerData[] }) {
  const { t } = useI18n();
  const rows = useMemo(() => markerExportRows(markers), [markers]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-gray-500">
        {t.admin.total}: <span className="font-mono font-bold text-gray-800">{rows.length}</span> 件
        （論理削除済みを除く）
      </p>

      <div className="flex gap-2">
        <Button onClick={() => saveExport('loca-markers', 'csv', MARKER_COLUMNS, rows)}>
          <i className="fa-solid fa-file-csv mr-1.5" />
          {t.admin.exportCsv}
        </Button>
        <Button variant="secondary" onClick={() => saveExport('loca-markers', 'json', MARKER_COLUMNS, rows)}>
          <i className="fa-solid fa-file-code mr-1.5" />
          {t.admin.exportJson}
        </Button>
      </div>

      <div className="max-h-80 overflow-auto rounded border border-gray-100">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
            <tr>
              {MARKER_COLUMNS.map((c) => (
                <th key={c} className="px-2 py-1.5">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr key={r.youtube_url} className="border-t border-gray-50">
                {MARKER_COLUMNS.map((c) => (
                  <td key={c} className={c === 'youtube_url' || c === 'memo' ? 'max-w-[20rem] truncate px-2 py-1' : 'px-2 py-1'}>
                    {r[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
