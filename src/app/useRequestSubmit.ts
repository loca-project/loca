/**
 * 撮影リクエストの登録。
 *
 * Firestore に保存し、使った熱量を数え直す。Firebase の設定が無い構成（services.requestStore が null）では投稿できない。
 */

import { useCallback, useEffect, useState } from 'react';
import type { LatLng, RequestEntry } from '@/core/types';
import { useServices } from '@/shared/hooks/useServices';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import type { RequestFormState } from '@/features/sidebar/RequestForm';

export interface RequestSubmitResult {
  ok: boolean;
  message: string;
  /** Firestore に保存したとき、地点の集計に足す 1 件 */
  saved?: RequestEntry;
}

/** uid が変わったら（ログイン・ログアウト）使った熱量を読み直す。 */
export function useRequestSubmit(uid: string | null) {
  const { requestStore } = useServices();
  const { t } = useI18n();
  const { loading, exclusive } = useExclusive();
  const [heatUsed, setHeatUsed] = useState<number | null>(null);

  useEffect(() => {
    if (!requestStore || !uid) {
      setHeatUsed(null);
      return undefined;
    }
    let cancelled = false;
    requestStore
      .heatUsed()
      .then((used) => !cancelled && setHeatUsed(used))
      .catch((e: unknown) => {
        console.error('[loca] 使った熱量を読めませんでした', e);
        if (!cancelled) setHeatUsed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [requestStore, uid]);

  const submit = useCallback(
    async (form: RequestFormState, pos: LatLng): Promise<RequestSubmitResult | undefined> => {
      if (!requestStore) return { ok: false, message: t.store.unavailable };

      return exclusive(async () => {
        try {
          const saved = await requestStore.create({
            lat: pos.lat,
            lng: pos.lng,
            heat: form.heat,
            season: form.season,
            timeOfDay: form.timeOfDay,
            atmosphere: form.atmosphere,
            equipment: { manufacturer: form.manufacturer, series: form.series, model: form.model },
          });
          setHeatUsed((used) => (used ?? 0) + form.heat);
          return { ok: true, message: t.store.requestSaved, saved };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      });
    },
    [requestStore, exclusive, t],
  );

  /** 本人のリクエストを取り下げる（1 件ずつ。印が 1 件ずつしか指せないため）。熱量はその分戻る。 */
  const withdraw = useCallback(
    async (entries: { id: string; heat: number }[]): Promise<(RequestSubmitResult & { removedIds: string[] }) | undefined> => {
      if (!requestStore) return { ok: false, message: t.store.unavailable, removedIds: [] };
      return exclusive(async () => {
        const removedIds: string[] = [];
        try {
          for (const entry of entries) {
            await requestStore.withdraw(entry);
            removedIds.push(entry.id);
            setHeatUsed((used) => Math.max(0, (used ?? 0) - entry.heat));
          }
          return { ok: true, message: t.request.withdrawn, removedIds };
        } catch (e) {
          // 途中で失敗しても、取り下げ済みの分は返す（画面の集計から外すため）
          return { ok: false, message: e instanceof Error ? e.message : String(e), removedIds };
        }
      });
    },
    [requestStore, exclusive, t],
  );

  return { submit, withdraw, loading, heatUsed };
}
