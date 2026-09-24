/**
 * マーカー管理のタブ（要件 5.2.5・T60）。ニックネームで投稿者を探し、その人のマーカーを選んで論理削除する。
 * 1 件だけ選んでいるときは「地図へジャンプ」を押せる。削除は論理削除だけ（ADR 0021）。
 * 消したマーカーは shared/localChanges.ts の知らせですぐ一覧から外す（ほかの人の画面には差分の購読で届く。ADR 0013）。
 */

import React, { useMemo, useState } from 'react';
import type { MarkerData } from '@/core/types';
import { markersOfOwner, postersMatching } from '@/core/logic/adminMarkers';
import { formatDate, interpolate } from '@/core/logic/format';
import { Button, TextInput } from '@/shared/components/Controls';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import { publishLocalChange } from '@/shared/localChanges';

interface MarkersTabProps {
  markers: MarkerData[];
  onJump: (marker: MarkerData) => void;
}

export default function MarkersTab({ markers, onJump }: MarkersTabProps) {
  const { adminStore } = useServices();
  const { t } = useI18n();
  const mt = t.admin.markers;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const posters = useMemo(() => postersMatching(markers, query).slice(0, 30), [markers, query]);
  const list = useMemo(() => (owner ? markersOfOwner(markers, owner) : []), [markers, owner]);
  // 一覧から消えた（論理削除した）マーカーは選択からも外す
  const selected = list.filter((m) => checked.has(m.id));

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const removeSelected = () => {
    if (!adminStore || selected.length === 0) return;
    if (!window.confirm(interpolate(mt.confirmDelete, { count: selected.length }))) return;
    void exclusive(async () => {
      try {
        const ids = selected.map((m) => m.id);
        const count = await adminStore.softDeleteMarkers(ids);
        publishLocalChange({ kind: 'markers', ids });
        toast.success(interpolate(mt.deleted, { count }));
        setChecked(new Set());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <section>
        <TextInput
          value={query}
          placeholder={mt.search}
          aria-label={mt.search}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="mt-2 max-h-[50vh] overflow-y-auto">
          {posters.map((p) => (
            <li key={p.ownerUid}>
              <button
                type="button"
                onClick={() => {
                  setOwner(p.ownerUid);
                  setChecked(new Set());
                }}
                className={`flex w-full justify-between rounded px-2 py-1.5 text-left text-xs ${
                  owner === p.ownerUid ? 'bg-loca-50 font-bold text-loca-700' : 'hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-gray-400">{p.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="min-w-0">
        {!owner ? (
          <p className="text-xs text-gray-500">{mt.pick}</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button variant="danger" disabled={loading || selected.length === 0} onClick={removeSelected}>
                {interpolate(mt.delete, { count: selected.length })}
              </Button>
              <Button variant="secondary" disabled={selected.length !== 1} onClick={() => onJump(selected[0])}>
                <i className="fa-solid fa-location-arrow mr-1.5" />
                {mt.jump}
              </Button>
              <p className="text-[11px] text-gray-500">{mt.note}</p>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto">
              {list.map((m) => (
                <li key={m.id} className="flex items-center gap-2 border-b border-gray-50 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={checked.has(m.id)}
                    onChange={() => toggle(m.id)}
                    aria-label={m.title ?? m.id}
                    className="h-4 w-4 accent-loca-500"
                  />
                  <span className="min-w-0 grow truncate">{m.title ?? m.youtubeUrl}</span>
                  <span className="shrink-0 text-[11px] text-gray-500">{[m.prefecture, m.city].filter(Boolean).join(' ')}</span>
                  <span className="shrink-0 text-[11px] text-gray-400">{formatDate(m.updatedAt)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
