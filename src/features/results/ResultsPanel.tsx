/**
 * 共通結果パネル（要件 2.3 / 4.1 / 4.4）。
 * サイドメニューの右端から 10px あけて配置し、開閉に連動して動く。
 * 行ごとのジャンプアイコンと、単一選択時のみ活性化する一括ジャンプボタンを持つ。
 */

import React, { useState } from 'react';
import type { LatLng } from '@/core/types';
import { interpolate } from '@/core/logic/format';
import { Button, IconButton } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import type { ResultRow } from './resultRow';

interface ResultsPanelProps {
  open: boolean;
  title: string;
  rows: ResultRow[];
  /** サイドメニュー右端の X 座標（px）。ここから 10px あけて置く */
  offsetLeft: number;
  /** フィルタによる 100 件制限の注記を出すか */
  limitedTo?: number;
  onClose: () => void;
  onJump: (position: LatLng) => void;
}

export default function ResultsPanel({
  open,
  title,
  rows,
  offsetLeft,
  limitedTo,
  onClose,
  onJump,
}: ResultsPanelProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 要件 3.6 / 4.4: 単一選択のときだけ活性。未選択・複数選択は非活性（非表示にはしない）
  const single = selected.size === 1 ? rows.find((r) => selected.has(r.id)) : undefined;
  const jumpEnabled = Boolean(single?.position);

  return (
    <section
      className="pointer-events-auto absolute bottom-4 top-4 z-30 flex w-[min(28rem,calc(100vw-5.5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur transition-[left] duration-200"
      style={{ left: offsetLeft + 10 }}
      aria-label={title}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <h2 className="text-xs font-bold text-gray-700">
          {title}
          <span className="ml-2 font-normal text-gray-400">
            {interpolate(t.results.count, { count: rows.length })}
          </span>
        </h2>
        <IconButton icon="fa-solid fa-xmark" label={t.close} onClick={onClose} />
      </header>

      <div className="grow overflow-y-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-xs text-gray-400">{t.results.empty}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  className="h-3.5 w-3.5 shrink-0 accent-loca-500"
                  aria-label={row.title}
                />
                {row.thumbnailUrl && (
                  <img src={row.thumbnailUrl} alt="" className="h-9 w-16 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 grow">
                  <p className="truncate text-[11px] font-bold text-gray-800">{row.title}</p>
                  {row.subtitle && <p className="truncate text-[10px] text-gray-500">{row.subtitle}</p>}
                </div>
                <span className="shrink-0 text-[11px] font-mono text-gray-600">{row.metric}</span>
                {row.link && (
                  <a
                    href={row.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[11px] text-loca-600 underline"
                  >
                    {t.results.link}
                  </a>
                )}
                <button
                  type="button"
                  disabled={!row.position}
                  onClick={() => row.position && onJump(row.position)}
                  title={t.form.jumpToMap}
                  aria-label={t.form.jumpToMap}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-loca-50 hover:text-loca-600 disabled:text-gray-200"
                >
                  <i className="fa-solid fa-location-crosshairs" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
        {limitedTo ? (
          <p className="text-[10px] text-gray-400">{interpolate(t.results.limitMsg, { limit: limitedTo })}</p>
        ) : (
          <span />
        )}
        <Button
          disabled={!jumpEnabled}
          onClick={() => single?.position && onJump(single.position)}
        >
          <i className="fa-solid fa-location-crosshairs mr-1.5" />
          {t.form.jumpToMap}
        </Button>
      </footer>
    </section>
  );
}
