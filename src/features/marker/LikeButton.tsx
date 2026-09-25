/**
 * マーカー情報のいいね（ADR 0016・0024）。投稿者への「ありがとう」で、順位の基準にはしない。
 * 件数は開いたときに読む（公開データには載せない）。自分の投稿には付けられないので、件数だけを出す。
 * 判定は表示の切り替えで、権限と件数の整合はルールが守る。
 */

import React, { useEffect, useState } from 'react';
import type { MarkerData } from '@/core/types';
import type { LikeState } from '@/ports';
import { interpolate } from '@/core/logic/format';
import { Button } from '@/shared/components/Controls';
import { useToast } from '@/shared/components/Toast';
import { useAuth } from '@/shared/hooks/useAuth';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';

export default function LikeButton({ marker }: { marker: MarkerData }) {
  const { likeStore } = useServices();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const [state, setState] = useState<LikeState | null>(null);
  const uid = user?.uid ?? null;
  const own = uid !== null && marker.ownerUid === uid;

  // マーカーを替えた・ログインした（自分が付けているかが変わる）ときに読み直す
  useEffect(() => {
    if (!likeStore) return undefined;
    let cancelled = false;
    setState(null);
    likeStore
      .state(marker.id)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((e: unknown) => console.warn('[loca] いいねの件数を読めませんでした', e));
    return () => {
      cancelled = true;
    };
  }, [likeStore, marker.id, uid]);

  if (!likeStore) return null;

  const onClick = () => {
    if (!uid) {
      toast.info(t.likes.login);
      return;
    }
    if (own || !state || !marker.ownerUid) return;
    const ownerUid = marker.ownerUid;
    void exclusive(async () => {
      try {
        setState(await likeStore.set({ id: marker.id, ownerUid }, !state.liked));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const liked = state?.liked === true;
  const label = interpolate(t.likes.label, { count: state ? state.count : '-' });
  return (
    <Button
      variant="secondary"
      className={`flex-1 ${liked ? 'text-pink-600' : ''}`}
      onClick={onClick}
      disabled={loading || own}
      aria-pressed={liked}
      title={own ? t.likes.own : liked ? t.likes.undo : t.likes.hint}
      data-loca-like={liked ? 'on' : 'off'}
    >
      <i className={`${liked ? 'fa-solid' : 'fa-regular'} fa-heart mr-1.5`} />
      {label}
    </Button>
  );
}
