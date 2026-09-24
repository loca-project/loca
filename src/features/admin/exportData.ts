/**
 * CSV・JSON の書き出し（要件 5.2.2）。管理者のデータエクスポートと、自分の投稿の「選んだものを書き出す」で共有する。
 * タグはキーのまま出す（言語によらず同じ値にするため）。論理削除済みは含めない。
 */

import type { MarkerData, RequestMarkerData } from '@/core/types';
import { TAG_FIELDS } from '@/core/constants';

/** マーカーの列。キーは CSV の見出しと JSON の項目名を兼ねる。 */
export const MARKER_COLUMNS = ['youtube_url', 'subject', 'mood', 'season', 'time_of_day', 'style', 'memo'] as const;
export type MarkerExportRow = Record<(typeof MARKER_COLUMNS)[number], string>;

/** 撮影リクエストの列（1 行が 1 件のリクエスト）。 */
export const REQUEST_COLUMNS = ['lat', 'lng', 'prefecture', 'city', 'heat', 'season', 'time_of_day', 'style', 'created_at'] as const;
export type RequestExportRow = Record<(typeof REQUEST_COLUMNS)[number], string>;

export function markerExportRows(markers: MarkerData[]): MarkerExportRow[] {
  return markers
    .filter((m) => !m.deleted)
    .map((m) => {
      const tag = Object.fromEntries(TAG_FIELDS.map((f) => [f, m.tags?.[f] ?? '']));
      return {
        youtube_url: m.youtubeUrl,
        subject: tag.subject,
        mood: tag.mood,
        season: tag.season,
        time_of_day: tag.timeOfDay,
        style: tag.style,
        memo: m.memo ?? '',
      };
    });
}

/** 地点ごとの集計から、uid のリクエストだけを 1 件 1 行にする。 */
export function requestExportRows(spots: RequestMarkerData[], uid: string): RequestExportRow[] {
  return spots.flatMap((spot) =>
    (spot.entries ?? [])
      .filter((e) => e.ownerUid === uid)
      .map((e) => ({
        lat: String(spot.lat),
        lng: String(spot.lng),
        prefecture: spot.prefecture ?? '',
        city: spot.city ?? '',
        heat: String(e.heat),
        season: e.season ?? '',
        time_of_day: e.timeOfDay ?? '',
        style: e.style ?? '',
        created_at: e.createdAt ? new Date(e.createdAt).toISOString() : '',
      })),
  );
}

/** CSV の値はダブルクォートで囲み、内部のクォートは 2 重にする。Excel が UTF-8 と判別できるよう BOM を付ける。 */
export function toCsv<C extends string>(columns: readonly C[], rows: Record<C, string>[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) => columns.map((c) => escape(r[c])).join(','));
  return `﻿${columns.join(',')}\n${lines.join('\n')}\n`;
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

/** `${prefix}-YYYY-MM-DD.csv|json` として保存させる。 */
export function saveExport<C extends string>(
  prefix: string,
  format: 'csv' | 'json',
  columns: readonly C[],
  rows: Record<C, string>[],
): void {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') download(`${prefix}-${stamp}.csv`, toCsv(columns, rows), 'text/csv');
  else download(`${prefix}-${stamp}.json`, JSON.stringify(rows, null, 2), 'application/json');
}
