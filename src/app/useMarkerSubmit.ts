/**
 * マーカー投稿の下ごしらえ。
 *
 * データベースが無いので、ここでは保存しない。
 * 入力を検証し、動画情報と地名を取得したうえで GitHub Issue フォームを開く。
 * 実際の反映は GitHub Actions が Issue を取り込んで markers.json を更新することで行う。
 */

import { useCallback, useState } from 'react';
import type { MarkerData } from '@/core/types';
import { getYoutubeId } from '@/core/logic/youtube';
import { validateMarkerDraft } from '@/core/logic/validation';
import { isValidEquipment } from '@/core/logic/equipment';
import { findDuplicateByVideoId } from '@/core/logic/search';
import { useServices } from '@/shared/hooks/useServices';
import { useI18n } from '@/shared/hooks/useI18n';
import { draftFromForm, type MarkerFormState } from '@/features/marker/formState';
import { openIssueForm } from '@/features/contribute/issueUrl';
import { canContribute } from '@/runtime/config';

export interface SubmitContext {
  form: MarkerFormState;
  existing: MarkerData[];
  equipment: Parameters<typeof isValidEquipment>[0];
}

export interface SubmitResult {
  ok: boolean;
  message: string;
}

export function useMarkerSubmit() {
  const { video, geocode } = useServices();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async (ctx: SubmitContext): Promise<SubmitResult> => {
      if (!canContribute()) return { ok: false, message: t.contribute.notConfigured };

      const issues = validateMarkerDraft(draftFromForm(ctx.form, ''));
      if (issues.length > 0) {
        return { ok: false, message: t.alerts[issues[0].messageKey as keyof typeof t.alerts] };
      }

      const videoId = getYoutubeId(ctx.form.youtubeUrl);
      if (!videoId) return { ok: false, message: t.alerts.invalidUrl };

      // 要件 3.3: 同じ動画が既に登録されていれば投稿させない
      if (findDuplicateByVideoId(ctx.existing, videoId, getYoutubeId)) {
        return { ok: false, message: t.alerts.duplicateUrl };
      }

      if (!isValidEquipment(ctx.equipment, ctx.form.manufacturer, ctx.form.series, ctx.form.model)) {
        return { ok: false, message: '登録されていない撮影機器の組み合わせです。' };
      }

      const lat = Number(ctx.form.lat);
      const lng = Number(ctx.form.lng);

      setLoading(true);
      try {
        // 動画情報は必須。地名は取れなくても Actions 側で再取得するので投稿は止めない。
        const [metaResult, placeResult] = await Promise.allSettled([
          video.fetchMeta(videoId),
          geocode.reverse(lat, lng),
        ]);

        if (metaResult.status === 'rejected') return { ok: false, message: t.alerts.fetchFail };
        const meta = metaResult.value;
        const place = placeResult.status === 'fulfilled' ? placeResult.value : null;

        const opened = openIssueForm('marker', {
          'video-url': `https://www.youtube.com/watch?v=${videoId}`,
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          'tag-action': ctx.form.tagAction,
          'tag-atmosphere': ctx.form.tagAtmosphere,
          'tag-emotion': ctx.form.tagEmotion,
          manufacturer: ctx.form.manufacturer,
          series: ctx.form.series,
          model: ctx.form.model,
          // 確認しやすいよう、取得済みの情報も本文に載せる
          'checked-title': meta.title,
          'checked-channel': meta.channelTitle,
          'checked-place': place ? `${place.prefecture} ${place.city}`.trim() : '',
        });

        if (!opened) return { ok: false, message: t.contribute.notConfigured };
        return { ok: true, message: t.contribute.openedBody };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      } finally {
        setLoading(false);
      }
    },
    [video, geocode, t],
  );

  return { submit, loading };
}
