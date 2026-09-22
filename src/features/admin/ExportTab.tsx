/**
 * データエクスポート（要件 5.2.2）。
 * 出力対象は Youtube URL と感情タグのみ。論理削除済みは含めない。
 */

import React, { useMemo } from 'react';
import type { MarkerData } from '@/core/types';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface ExportRow {
  youtubeUrl: string;
  action: string;
  atmosphere: string;
  emotion: string;
}

function toRows(markers: MarkerData[]): ExportRow[] {
  return markers
    .filter((m) => !m.deleted)
    .map((m) => ({
      youtubeUrl: m.youtubeUrl,
      action: m.tags?.action ?? '',
      atmosphere: m.tags?.atmosphere ?? '',
      emotion: m.tags?.emotion ?? '',
    }));
}

/** CSV の値はダブルクォートで囲み、内部のクォートは 2 重にする。 */
function toCsv(rows: ExportRow[]): string {
  const header = ['youtube_url', 'tag_action', 'tag_atmosphere', 'tag_emotion'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.youtubeUrl, r.action, r.atmosphere, r.emotion].map(escape).join(','),
  );
  // Excel が UTF-8 と判別できるよう BOM を付ける
  return `﻿${header.join(',')}\n${lines.join('\n')}\n`;
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportTab({ markers }: { markers: MarkerData[] }) {
  const { t } = useI18n();
  const rows = useMemo(() => toRows(markers), [markers]);
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-gray-500">
        {t.admin.total}: <span className="font-mono font-bold text-gray-800">{rows.length}</span> 件
        （論理削除済みを除く）
      </p>

      <div className="flex gap-2">
        <Button onClick={() => download(`loca-markers-${stamp}.csv`, toCsv(rows), 'text/csv')}>
          <i className="fa-solid fa-file-csv mr-1.5" />
          {t.admin.exportCsv}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            download(
              `loca-markers-${stamp}.json`,
              JSON.stringify(rows, null, 2),
              'application/json',
            )
          }
        >
          <i className="fa-solid fa-file-code mr-1.5" />
          {t.admin.exportJson}
        </Button>
      </div>

      <div className="max-h-80 overflow-auto rounded border border-gray-100">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-2 py-1.5">youtube_url</th>
              <th className="px-2 py-1.5">action</th>
              <th className="px-2 py-1.5">atmosphere</th>
              <th className="px-2 py-1.5">emotion</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr key={r.youtubeUrl} className="border-t border-gray-50">
                <td className="max-w-[20rem] truncate px-2 py-1">{r.youtubeUrl}</td>
                <td className="px-2 py-1">{r.action}</td>
                <td className="px-2 py-1">{r.atmosphere}</td>
                <td className="px-2 py-1">{r.emotion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
