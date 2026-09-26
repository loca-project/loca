/**
 * 人のタブ（T88・ADR 0031）。投稿者を名前の一部で探し、再生数・投稿数・最近の順に並べる。
 * 地図の一覧から数えるだけで Firestore は読まない。名前を押すと投稿者の公開プロフィール（T82）を開く。
 */

import React, { useMemo, useState } from 'react';
import type { MarkerData } from '@/core/types';
import { formatCount, formatDate, interpolate } from '@/core/logic/format';
import { rankPosters, searchPosters, summarizePosters, type PosterOrder, type PosterSummary } from '@/core/logic/people';
import { Field, Segmented, TextInput } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

/** 一覧に出す人数。サイドメニューで追える長さに抑える */
const LIST_LIMIT = 30;

interface PeoplePanelProps {
  markers: MarkerData[];
  onOpen: (poster: { uid: string; name: string }) => void;
}

export default function PeoplePanel({ markers, onOpen }: PeoplePanelProps) {
  const { t } = useI18n();
  const pt = t.people;
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<PosterOrder>('views');
  const posters = useMemo(() => summarizePosters(markers), [markers]);
  const searching = query.trim() !== '';
  const rows = useMemo(
    () => (searching ? searchPosters(posters, query, LIST_LIMIT) : rankPosters(posters, order, LIST_LIMIT)),
    [posters, query, order, searching],
  );

  const detail = (p: PosterSummary) =>
    !searching && order === 'recent'
      ? interpolate(pt.latest, { date: formatDate(p.latestAt) })
      : interpolate(pt.stats, { posts: formatCount(p.posts), views: formatCount(p.views) });

  return (
    <div className="flex flex-col gap-3">
      <Field label={pt.search}>
        <TextInput type="search" value={query} placeholder={pt.placeholder} onChange={(e) => setQuery(e.target.value)} />
      </Field>

      {!searching && (
        <Segmented
          value={order}
          onChange={setOrder}
          options={[
            { value: 'views', label: pt.byViews },
            { value: 'posts', label: pt.byPosts },
            { value: 'recent', label: pt.recent },
          ]}
        />
      )}

      {rows.length === 0 ? (
        <p className="rounded-md bg-gray-50 p-3 text-center text-[11px] text-gray-500">{searching ? pt.noHit : pt.empty}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
          {rows.map((p, i) => (
            <li key={p.uid}>
              <button
                type="button"
                onClick={() => onOpen({ uid: p.uid, name: p.name })}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
              >
                {!searching && <span className="w-5 shrink-0 text-right text-[11px] font-bold text-gray-400">{i + 1}</span>}
                <i className="fa-solid fa-circle-user text-lg text-gray-300" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-gray-800">{p.name}</span>
                  <span className="block text-[10px] text-gray-500">{detail(p)}</span>
                </span>
                <i className="fa-solid fa-chevron-right text-[10px] text-gray-300" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="text-[10px] leading-relaxed text-gray-400">{pt.note}</p>
    </div>
  );
}
