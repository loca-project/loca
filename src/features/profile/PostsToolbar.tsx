/**
 * 自分の投稿の一覧の上に置く操作（T53 改訂）: すべて選択・選んだものを削除・選んだものを書き出す（CSV / JSON）。
 * 選択は ids で持ち、一覧から消えた行（削除・取り下げが購読で届いた）は自動で選択から外す。
 */

import React, { useCallback, useMemo, useState } from 'react';
import { interpolate } from '@/core/logic/format';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

/** 一覧の行の ID に対する選択。 */
export function useSelection(ids: string[]) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // 一覧に残っているものだけを選択とみなす
  const selected = useMemo(() => ids.filter((id) => picked.has(id)), [ids, picked]);
  const toggle = useCallback(
    (id: string) =>
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const setAll = useCallback((on: boolean) => setPicked(on ? new Set(ids) : new Set()), [ids]);
  return { selected, isPicked: (id: string) => picked.has(id), toggle, setAll };
}

interface PostsToolbarProps {
  total: number;
  selectedCount: number;
  busy: boolean;
  /** 「選んだ {count} 件を削除」など、削除ボタンの文言 */
  deleteLabel: string;
  onSelectAll: (on: boolean) => void;
  onDelete: () => void;
  onExport: (format: 'csv' | 'json') => void;
}

export default function PostsToolbar(props: PostsToolbarProps) {
  const { total, selectedCount, busy, deleteLabel, onSelectAll, onDelete, onExport } = props;
  const { t } = useI18n();
  const all = total > 0 && selectedCount === total;
  const none = selectedCount === 0;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2">
      <label className="mr-2 flex cursor-pointer items-center gap-1.5 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={all}
          ref={(el) => {
            if (el) el.indeterminate = !all && !none;
          }}
          disabled={total === 0}
          onChange={(e) => onSelectAll(e.target.checked)}
          className="h-4 w-4 accent-loca-500"
        />
        {interpolate(t.myPosts.selectAll, { selected: selectedCount, total })}
      </label>
      <Button variant="danger" disabled={busy || none} onClick={onDelete}>
        <i className="fa-solid fa-trash mr-1.5" />
        {interpolate(deleteLabel, { count: selectedCount })}
      </Button>
      <Button variant="secondary" disabled={none} onClick={() => onExport('csv')}>
        <i className="fa-solid fa-file-csv mr-1.5" />
        {t.admin.exportCsv}
      </Button>
      <Button variant="secondary" disabled={none} onClick={() => onExport('json')}>
        <i className="fa-solid fa-file-code mr-1.5" />
        {t.admin.exportJson}
      </Button>
    </div>
  );
}
