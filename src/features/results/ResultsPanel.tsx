/**
 * 共通結果パネル（要件 2.3 / 4.1 / 4.4）。
 * サイドメニューの右端から 10px あけて配置し、開閉に連動して動く。
 * 行ごとに「地図へ」「共有」のボタンを持つ。チェックボックスと下部の一括ジャンプは置かない
 * （複数選んだときにどこへ飛ぶのか分からないため。2026-09-25）。
 */

import React from 'react';
import type { LatLng } from '@/core/types';
import { interpolate } from '@/core/logic/format';
import { Button, IconButton } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import type { ResultRow } from './resultRow';

const PANEL_CLASS = [
  'pointer-events-auto absolute bottom-4 top-4 z-30 flex w-[min(28rem,calc(100vw-5.5rem))] flex-col overflow-hidden',
  'rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur transition-[left] duration-200',
].join(' ');

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
  /** マーカーの行の「共有」。そのマーカーを開く URL をコピーする */
  onShare?: (markerId: string) => void;
}

export default function ResultsPanel({
  open,
  title,
  rows,
  offsetLeft,
  limitedTo,
  onClose,
  onJump,
  onShare,
}: ResultsPanelProps) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <section
      className={PANEL_CLASS}
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
                {row.thumbnailUrl && (
                  <img src={row.thumbnailUrl} alt="" className="h-9 w-16 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 grow">
                  <p className="truncate text-[11px] font-bold text-gray-800">{row.title}</p>
                  {row.subtitle && <p className="truncate text-[10px] text-gray-500">{row.subtitle}</p>}
                </div>
                <span className="shrink-0 text-[11px] font-mono text-gray-600">{row.metric}</span>
                {/* 動線の順（見に行く → 人に渡す）に、同じ大きさで並べる。文言は自分の投稿・マーカーの詳細とそろえる */}
                <Button
                  variant="secondary"
                  className="w-20 shrink-0"
                  disabled={!row.position}
                  onClick={() => row.position && onJump(row.position)}
                  title={t.form.jumpToMap}
                >
                  <i className="fa-solid fa-location-arrow mr-1" />
                  {t.myPosts.jump}
                </Button>
                {onShare && row.markerId && (
                  <Button variant="secondary" className="w-20 shrink-0" onClick={() => onShare(row.markerId!)}>
                    <i className="fa-solid fa-share-nodes mr-1" />
                    {t.actions.share}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {limitedTo ? (
        <footer className="shrink-0 border-t border-gray-100 px-3 py-2">
          <p className="text-[10px] text-gray-400">{interpolate(t.results.limitMsg, { limit: limitedTo })}</p>
        </footer>
      ) : null}
    </section>
  );
}
