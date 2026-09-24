/** 自分の投稿の一覧の 1 行（T53 改訂）: チェック・題名と補足・地図へ・削除。 */

import React from 'react';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface PostRowProps {
  title: string;
  sub: string;
  checked: boolean;
  busy: boolean;
  /** 行の削除ボタンの文言（投稿動画は「削除」、撮影リクエストは「取り下げ」） */
  deleteLabel: string;
  onToggle: () => void;
  onJump: () => void;
  onDelete: () => void;
}

export default function PostRow({ title, sub, checked, busy, deleteLabel, onToggle, onJump, onDelete }: PostRowProps) {
  const { t } = useI18n();
  return (
    <li className="flex items-center gap-2 border-b border-gray-50 py-2">
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={title} className="h-4 w-4 shrink-0 accent-loca-500" />
      <span className="min-w-0 grow">
        <span className="block truncate text-xs font-bold text-gray-800">{title}</span>
        <span className="block truncate text-[11px] text-gray-500">{sub}</span>
      </span>
      <Button variant="secondary" className="w-24 shrink-0" onClick={onJump}>
        <i className="fa-solid fa-location-arrow mr-1" />
        {t.myPosts.jump}
      </Button>
      <Button variant="dangerSoft" className="w-24 shrink-0" disabled={busy} onClick={onDelete}>
        {deleteLabel}
      </Button>
    </li>
  );
}
