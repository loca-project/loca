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
  const updateAvailable = health?.updateAvailable ?? false;
  if (messages.length === 0 && !updateAvailable) return null;

  return (
    // スマホ幅では右上のログインボタンと重ならないよう、その下に出す
    <div role="status" className="absolute left-1/2 top-16 z-30 sm:top-4 w-[min(28rem,calc(100%-8rem))] -translate-x-1/2">
      {/* 新しい版の案内（T56）。古いままだと、先に新しくなったルールに書き込みを拒否されうる */}
      {updateAvailable && (
        <p className="mb-1 flex items-center gap-2 rounded-md bg-sky-50 px-3 py-2 text-[11px] text-sky-800 shadow-md">
          <i className="fa-solid fa-rotate" />
          <span className="flex-1">{t.runtime.updateAvailable}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded bg-sky-600 px-2 py-1 font-bold text-white hover:bg-sky-700"
          >
            {t.runtime.reload}
          </button>
        </p>
      )}
      {messages.map((m) => (
        <p key={m} className="mb-1 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800 shadow-md">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" />
          {m}
        </p>
      ))}
    </div>
  );
}
