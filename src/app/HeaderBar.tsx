/**
 * 画面右上のメニュー。
 *
 * ボタンを 5 つ並べると地図を隠すので、1 つのプルダウンに集約している。
 * 認証は未導入のため、ここに「ログイン」は無い。
 * 導入するときはこのプルダウンの最上段に足す想定（[ADR 0009] 参照）。
 */

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import { issueListUrl } from '@/features/contribute/issueUrl';
import { canContribute } from '@/runtime/config';
import DataFreshness from './DataFreshness';

interface HeaderBarProps {
  onOpenStats: () => void;
  onOpenGuide: () => void;
}

export default function HeaderBar({ onOpenStats, onOpenGuide }: HeaderBarProps) {
  const { t, lang, changeLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const repoUrl = issueListUrl();

  // メニューの外側をクリック、または Esc で閉じる
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100';

  return (
    <div ref={ref} className="absolute right-4 top-4 z-40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.menu.label}
        title={t.menu.label}
        className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-md hover:bg-gray-50"
      >
        <i className="fa-solid fa-bars" />
        <span className="hidden sm:inline">{t.menu.label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              onOpenStats();
              setOpen(false);
            }}
          >
            <i className="fa-solid fa-chart-pie w-4 text-gray-400" />
            {t.admin.title}
          </button>

          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              onOpenGuide();
              setOpen(false);
            }}
          >
            <i className="fa-solid fa-circle-question w-4 text-gray-400" />
            {t.contribute.guideTitle}
          </button>

          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => changeLanguage(lang === 'ja' ? 'en' : 'ja')}
          >
            <i className="fa-solid fa-language w-4 text-gray-400" />
            {t.menu.language}
            <span className="ml-auto font-mono text-[10px] text-gray-400">
              {lang === 'ja' ? '日本語' : 'English'}
            </span>
          </button>

          {canContribute() && repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={item}
              onClick={() => setOpen(false)}
            >
              <i className="fa-brands fa-github w-4 text-gray-400" />
              {t.contribute.repoLink}
              <i className="fa-solid fa-arrow-up-right-from-square ml-auto text-[9px] text-gray-300" />
            </a>
          )}

          <div className="my-1 border-t border-gray-100" />
          <DataFreshness />
        </div>
      )}
    </div>
  );
}
