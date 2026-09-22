/** 集計結果の横棒表示。件数の比較ができれば十分なので図書館は入れない。 */

import React from 'react';
import type { CountRow } from '@/core/logic/statistics';

export default function BarList({ title, rows }: { title: string; rows: CountRow[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

  return (
    <section className="rounded border border-gray-100 p-3">
      <h3 className="mb-2 text-[11px] font-bold text-gray-600">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-gray-400">-</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.slice(0, 12).map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-24 shrink-0 truncate text-gray-600">{r.label}</span>
              <span className="h-2 grow overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full bg-loca-500"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-gray-700">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
