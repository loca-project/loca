/**
 * 撮影リクエストの登録。
 *
 * Firebase が使える構成（services.requestStore がある）なら Firestore に保存し、使った熱量を数え直す。
 * 使えない構成では GitHub Issue フォームを開くだけ（T10 で廃止）。
 */

import { useCallback, useEffect, useState } from 'react';
import type { LatLng, RequestEntry } from '@/core/types';
import { useServices } from '@/shared/hooks/useServices';
import { useI18n } from '@/shared/hooks/useI18n';
import { openIssueForm } from '@/features/contribute/issueUrl';
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
  const [loading, setLoading] = useState(false);
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
    async (form: RequestFormState, pos: LatLng): Promise<RequestSubmitResult> => {
      if (!requestStore) {
        const opened = openIssueForm(
          'request',
          {
            lat: pos.lat.toFixed(6),
            lng: pos.lng.toFixed(6),
            heat: String(form.heat),
            season: form.season,
            'time-of-day': form.timeOfDay,
            atmosphere: form.atmosphere,
            manufacturer: form.manufacturer,
            series: form.series,
            model: form.model,
          },
          `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)} 熱量${form.heat}`,
        );
        return opened
          ? { ok: true, message: t.contribute.openedTitle }
          : { ok: false, message: t.contribute.notConfigured };
      }

      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    },
    [requestStore, t],
  );

  return { submit, loading, heatUsed, usesStore: requestStore !== null };
}
