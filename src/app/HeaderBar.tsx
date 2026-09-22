/**
 * 画面右上のヘッダ。
 * 認証が無いので、あるのは言語切替・データ鮮度・統計・投稿の入口だけ。
 */

import React from 'react';
import { Button } from '@/shared/components/Controls';
import RuntimeBadge from '@/shared/components/RuntimeBadge';
import { useI18n } from '@/shared/hooks/useI18n';
import { issueListUrl } from '@/features/contribute/issueUrl';
import { canContribute } from '@/runtime/config';

interface HeaderBarProps {
  onOpenStats: () => void;
  onOpenGuide: () => void;
}

export default function HeaderBar({ onOpenStats, onOpenGuide }: HeaderBarProps) {
  const { t, lang, changeLanguage } = useI18n();
  const repoUrl = issueListUrl();

  return (
    <div className="absolute right-4 top-4 z-40 flex items-center gap-2">
      <RuntimeBadge />

      <button
        type="button"
        onClick={() => changeLanguage(lang === 'ja' ? 'en' : 'ja')}
        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold text-gray-500 shadow-sm hover:bg-gray-50"
      >
        {lang === 'ja' ? 'EN' : 'JA'}
      </button>

      <Button variant="secondary" onClick={onOpenStats} className="shadow-sm" title={t.admin.title}>
        <i className="fa-solid fa-chart-pie" />
        <span className="ml-1.5 hidden sm:inline">{t.stats}</span>
      </Button>

      <Button variant="secondary" onClick={onOpenGuide} className="shadow-sm" title={t.contribute.guideTitle}>
        <i className="fa-solid fa-circle-question" />
      </Button>

      {canContribute() && repoUrl && (
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t.contribute.repoLink}
          className="rounded bg-gray-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-gray-700"
        >
          <i className="fa-brands fa-github" />
        </a>
      )}
    </div>
  );
}
