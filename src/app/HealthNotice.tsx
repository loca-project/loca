/**
 * 公開データか地図タイルを読めなかったときだけ、画面上部に帯で知らせる。
 * 普段は何も出さない（メニューに生成日時を並べると利用者が迷うため、不調のときだけにした）。
 * 黙って欠けたデータを見せないための表明（CP-1）。
 */

import React, { useEffect, useState } from 'react';
import type { RuntimeHealth } from '@/runtime/health';
import { subscribeHealth } from '@/runtime/health';
import { useI18n } from '@/shared/hooks/useI18n';

export default function HealthNotice() {
  const { t } = useI18n();
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  useEffect(() => subscribeHealth(setHealth), []);

  const messages = [
    health?.dataUnavailable ? t.runtime.dataUnavailable : '',
    health?.mapUnavailable ? t.runtime.mapUnavailable : '',
    health?.notice ?? '',
  ].filter(Boolean);
  if (messages.length === 0) return null;

  return (
    <div role="status" className="absolute left-1/2 top-4 z-30 w-[min(28rem,calc(100%-8rem))] -translate-x-1/2">
      {messages.map((m) => (
        <p key={m} className="mb-1 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800 shadow-md">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" />
          {m}
        </p>
      ))}
    </div>
  );
}
