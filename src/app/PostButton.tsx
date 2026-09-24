/**
 * 地図の下中央の「＋ 投稿する」（指摘 9）。
 * 押すと次の地図クリックで場所を選ぶ状態になり、案内とキャンセルを出す。Esc でも取り消せる。
 * 投稿モード中（サイドメニューにフォームが出ている間）は出さない。
 */

import React, { useEffect } from 'react';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface PostButtonProps {
  /** サイドメニューの右端。地図の見える範囲の中央に置くために使う */
  offsetLeft: number;
  picking: boolean;
  hidden: boolean;
  onStart: () => void;
  onCancel: () => void;
}

export default function PostButton({ offsetLeft, picking, hidden, onStart, onCancel }: PostButtonProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!picking) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking, onCancel]);

  if (hidden) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-6 z-30 flex justify-center px-4 transition-[left] duration-200"
      style={{ left: offsetLeft, right: 0 }}
    >
      {picking ? (
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900/90 py-1.5 pl-4 pr-1.5 text-xs text-white shadow-lg">
          <i className="fa-solid fa-crosshairs text-loca-200" />
          {t.post.picking}
          <Button variant="secondary" pill onClick={onCancel}>
            {t.form.cancel}
          </Button>
        </div>
      ) : (
        <Button pill className="pointer-events-auto px-5 shadow-lg" onClick={onStart}>
          <i className="fa-solid fa-plus mr-1.5" />
          {t.post.start}
        </Button>
      )}
    </div>
  );
}
