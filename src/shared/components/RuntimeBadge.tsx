/**
 * 公開データの鮮度と、読み込みに問題があったかの表示。
 * 黙って古いデータや欠損したデータを見せないための表明（CP-1）。
 */

import React, { useEffect, useState } from 'react';
import type { RuntimeHealth } from '@/runtime/health';
import { subscribeHealth } from '@/runtime/health';
import { formatDateTime } from '@/core/logic/format';
import { useI18n } from '../hooks/useI18n';

export default function RuntimeBadge() {
  const { t } = useI18n();
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeHealth(setHealth), []);
  if (!health) return null;

  const degraded = health.dataUnavailable || health.mapFallback;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t.runtime.title}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm ${
          degraded
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-gray-200 bg-white text-gray-500'
        }`}
      >
        <i className={`fa-solid ${degraded ? 'fa-triangle-exclamation' : 'fa-database'}`} />
        {degraded ? t.runtime.degraded : t.runtime.upToDate}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-100 bg-white p-3 text-[11px] shadow-lg">
          <p className="mb-2 font-bold text-gray-700">{t.runtime.title}</p>
          <dl className="grid grid-cols-2 gap-y-1 text-gray-600">
            <dt>{t.runtime.generatedAt}</dt>
            <dd className="text-right font-mono">
              {health.generatedAt ? formatDateTime(health.generatedAt) : '-'}
            </dd>
          </dl>
          {health.dataUnavailable && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-amber-800">{t.runtime.dataUnavailable}</p>
          )}
          {health.mapFallback && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-amber-800">{t.runtime.mapFallback}</p>
          )}
          {health.notice && <p className="mt-2 text-gray-500">{health.notice}</p>}
        </div>
      )}
    </div>
  );
}
