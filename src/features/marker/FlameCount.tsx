/**
 * マーカー情報に出す、この動画が受け取った炎（撮影リクエストに応えて受け取られた熱量の合計。ADR 0028・T82）。
 * 開いたときに answerCounts/{markerId} を 1 回読む（公開データには載せない）。0 なら何も出さない。
 */

import React, { useEffect, useState } from 'react';
import type { Flames } from '@/ports';
import { interpolate } from '@/core/logic/format';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';

export default function FlameCount({ markerId }: { markerId: string }) {
  const { requestStore } = useServices();
  const { t } = useI18n();
  const [flames, setFlames] = useState<Flames | null>(null);

  useEffect(() => {
    if (!requestStore) return undefined;
    let cancelled = false;
    setFlames(null);
    requestStore
      .flamesOf(markerId)
      .then((f) => {
        if (!cancelled) setFlames(f);
      })
      .catch((e: unknown) => console.warn('[loca] 炎を読めませんでした', e));
    return () => {
      cancelled = true;
    };
  }, [requestStore, markerId]);

  if (!flames || flames.count === 0) return null;
  return (
    <p className="rounded bg-orange-50 px-2 py-1.5 text-[11px] text-orange-800">
      <i className="fa-solid fa-fire mr-1" />
      {interpolate(t.poster.markerFlames, { heat: flames.heat, count: flames.count })}
    </p>
  );
}
