/**
 * 投稿者の公開プロフィール（T82）。マーカー情報の投稿者名を押すと開く。ログインしていなくても見られる。
 * 投稿動画は地図の一覧から数える（論理削除したものは入らない）。いいねと炎（ADR 0028）は投稿者ごとの集計の問い合わせで読む
 * （それぞれ読み取り 1 件分）。集計には論理削除した動画の分も入る（件数の文書は残るため）。
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { MarkerData } from '@/core/types';
import type { Flames } from '@/ports';
import { formatDate, interpolate } from '@/core/logic/format';
import { myMarkers } from '@/core/logic/myPosts';
import Modal from '@/shared/components/Modal';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';

export interface Poster {
  uid: string;
  /** 投稿者名（マーカーの createdBy。プロフィールのニックネームに追従する。ADR 0019） */
  name: string;
}

interface PosterProfileModalProps {
  poster: Poster;
  markers: MarkerData[];
  onPick: (marker: MarkerData) => void;
  onClose: () => void;
}

export default function PosterProfileModal({ poster, markers, onPick, onClose }: PosterProfileModalProps) {
  const { t } = useI18n();
  const pt = t.poster;
  const posts = useMemo(() => myMarkers(markers, poster.uid), [markers, poster.uid]);
  const totals = usePosterTotals(poster.uid);

  const stat = (icon: string, color: string, label: string, value: string) => (
    <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center">
      <i className={`fa-solid ${icon} ${color}`} />
      <p className="mt-1 text-lg font-bold text-gray-800">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
  const pending = t.details.loading;

  return (
    <Modal open title={interpolate(pt.title, { name: poster.name })} size="md" onClose={onClose}>
      <div className="flex gap-2">
        {stat('fa-video', 'text-indigo-500', pt.posts, String(posts.length))}
        {stat('fa-heart', 'text-pink-500', pt.likes, totals ? String(totals.likes) : pending)}
        {stat('fa-fire', 'text-orange-500', pt.flames, totals ? String(totals.flames.heat) : pending)}
      </div>
      {totals && totals.flames.count > 0 && (
        <p className="mt-2 text-center text-[11px] text-orange-700">{interpolate(pt.answered, { count: totals.flames.count })}</p>
      )}
      <p className="mt-2 text-[10px] text-gray-400">{pt.note}</p>
      <h3 className="mb-1 mt-4 text-xs font-bold text-gray-700">{pt.list}</h3>
      {posts.length === 0 ? (
        <p className="text-xs text-gray-500">{pt.empty}</p>
      ) : (
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
          {posts.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2 text-xs">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-gray-800">{m.title ?? m.youtubeUrl}</span>
                <span className="text-[11px] text-gray-500">
                  {[m.prefecture, m.city].filter(Boolean).join(' ') || '-'} ・ {formatDate(m.createdAt)}
                </span>
              </span>
              <button type="button" onClick={() => onPick(m)} className="shrink-0 rounded border border-gray-300 px-2 py-1">
                {t.myPosts.jump}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** いいねと炎の合計。開いたときに 1 回読む。読めなければ 0 として出す（画面は止めない）。 */
function usePosterTotals(uid: string): { likes: number; flames: Flames } | null {
  const { likeStore, requestStore } = useServices();
  const [totals, setTotals] = useState<{ likes: number; flames: Flames } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTotals(null);
    const warn = (what: string) => (e: unknown) => {
      console.warn(`[loca] ${what}を読めませんでした`, e);
      return null;
    };
    void Promise.all([
      likeStore ? likeStore.totalFor(uid).catch(warn('いいねの合計')) : null,
      requestStore ? requestStore.flamesFor(uid).catch(warn('炎の合計')) : null,
    ]).then(([likes, flames]) => {
      if (!cancelled) setTotals({ likes: likes ?? 0, flames: flames ?? { heat: 0, count: 0 } });
    });
    return () => {
      cancelled = true;
    };
  }, [likeStore, requestStore, uid]);
  return totals;
}
