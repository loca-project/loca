/**
 * 公開データの鮮度と、読み込みに問題があったかの表示。
 *
 * 以前は画面右上に独立したバッジとして出していたが、
 * メニューに集約したためプルダウン内の 1 行になった。
 * 黙って古いデータや欠損したデータを見せないための表明（CP-1）。
 */

import React, { useEffect, useState } from 'react';
import type { RuntimeHealth } from '@/runtime/health';
import { subscribeHealth } from '@/runtime/health';
import { formatDateTime } from '@/core/logic/format';
import { useI18n } from '@/shared/hooks/useI18n';

export default function DataFreshness() {
  const { t } = useI18n();
  const [health, setHealth] = useState<RuntimeHealth | null>(null);

  useEffect(() => subscribeHealth(setHealth), []);
  if (!health) return null;

  const degraded = health.dataUnavailable || health.mapUnavailable;

  return (
    <div className="px-3 py-2">
      <p className="mb-1 flex items-center gap-2 text-[10px] font-bold text-gray-400">
        <i className={`fa-solid ${degraded ? 'fa-triangle-exclamation text-amber-500' : 'fa-database'} w-4`} />
        {t.runtime.title}
      </p>

      <dl className="flex justify-between text-[11px] text-gray-600">
        <dt>{t.runtime.generatedAt}</dt>
        <dd className="font-mono">
          {health.generatedAt ? formatDateTime(health.generatedAt) : '-'}
        </dd>
      </dl>

      {health.dataUnavailable && (
        <p className="mt-1.5 rounded bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800">
          {t.runtime.dataUnavailable}
        </p>
      )}
      {health.mapUnavailable && (
        <p className="mt-1.5 rounded bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800">
          {t.runtime.mapUnavailable}
        </p>
      )}
    </div>
  );
}
