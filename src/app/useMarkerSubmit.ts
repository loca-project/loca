/**
 * マーカーの登録・更新・削除。
 *
 * Firebase が使える構成（services.markerStore がある）なら Firestore に保存する（ADR 0010）。
 * 使えない構成では、従来どおり GitHub Issue フォームを開くだけで保存しない（移行が終わるまでの暫定。T10 で廃止）。
 * どちらも、入力の検証と動画情報・地名の取得は共通。
 */

import { useCallback, useState } from 'react';
import type { MarkerContent, MarkerData, PlaceMeta, VideoMeta } from '@/core/types';
import { getYoutubeId } from '@/core/logic/youtube';
import { validateMarkerDraft } from '@/core/logic/validation';
import { isValidEquipment } from '@/core/logic/equipment';
import { findDuplicateByVideoId } from '@/core/logic/search';
import { pseudonymOf } from '@/core/logic/format';
import type { AuthUser } from '@/ports';
import { useServices } from '@/shared/hooks/useServices';
import { useI18n } from '@/shared/hooks/useI18n';
import { draftFromForm, type MarkerFormState } from '@/features/marker/formState';
import { openIssueForm } from '@/features/contribute/issueUrl';
import { canContribute } from '@/runtime/config';

export interface SubmitContext {
  form: MarkerFormState;
  existing: MarkerData[];
  equipment: Parameters<typeof isValidEquipment>[0];
  /** 編集中のマーカー。新規登録なら null */
  editing: MarkerData | null;
}

export interface SubmitResult {
  ok: boolean;
  message: string;
  /** Firestore に保存したとき、手元の一覧に反映する形 */
  saved?: MarkerData;
}

/** 保存する内容を組み立てる。地名が取れなければ編集前の値を残す。 */
function contentOf(form: MarkerFormState, videoId: string, meta: VideoMeta, place: PlaceMeta | null, prev: MarkerData | null) {
  const content: MarkerContent = {
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    lat: Number(form.lat),
    lng: Number(form.lng),
    tags: { action: form.tagAction, atmosphere: form.tagAtmosphere, emotion: form.tagEmotion },
    equipment: { manufacturer: form.manufacturer, series: form.series, model: form.model },
    title: meta.title,
    channelTitle: meta.channelTitle,
    thumbnailUrl: meta.thumbnailUrl,
    prefecture: place?.prefecture ?? prev?.prefecture,
    city: place?.city ?? prev?.city,
  };
  return content;
}

/** 保存直後に手元の一覧へ入れる形。時刻は端末の時計で近似する（正確な値は Firestore 側にある）。 */
function localMarker(id: string, content: MarkerContent, user: AuthUser, prev: MarkerData | null): MarkerData {
  const now = Date.now();
  return {
    ...content,
    id,
    ownerUid: prev?.ownerUid ?? user.uid,
    createdBy: prev?.createdBy ?? pseudonymOf(user.uid),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    deleted: false,
  };
}

/** Firebase が使えない構成の暫定経路。GitHub Issue フォームを開く。 */
function openMarkerIssue(form: MarkerFormState, videoId: string, meta: VideoMeta, place: PlaceMeta | null): boolean {
  const placeLabel = place ? `${place.prefecture} ${place.city}`.trim() : '';
  const summary = [placeLabel, meta.title].filter(Boolean).join(' / ');
  return openIssueForm(
    'marker',
    {
      'video-url': `https://www.youtube.com/watch?v=${videoId}`,
      lat: Number(form.lat).toFixed(6),
      lng: Number(form.lng).toFixed(6),
      'tag-action': form.tagAction,
      'tag-atmosphere': form.tagAtmosphere,
      'tag-emotion': form.tagEmotion,
      manufacturer: form.manufacturer,
      series: form.series,
      model: form.model,
    },
    summary,
  );
}

export function useMarkerSubmit() {
  const { video, geocode, auth, markerStore } = useServices();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async (ctx: SubmitContext): Promise<SubmitResult> => {
      const user = auth?.currentUser() ?? null;
      if (markerStore && !user) return { ok: false, message: t.store.loginRequired };
      if (!markerStore && !canContribute()) return { ok: false, message: t.contribute.notConfigured };

      const issues = validateMarkerDraft(draftFromForm(ctx.form, ''));
      if (issues.length > 0) {
        return { ok: false, message: t.alerts[issues[0].messageKey as keyof typeof t.alerts] };
      }

      const videoId = getYoutubeId(ctx.form.youtubeUrl);
      if (!videoId) return { ok: false, message: t.alerts.invalidUrl };

      // 要件 3.3: 同じ動画が既に登録されていれば登録させない（編集中の自分自身は除く）
      const others = ctx.existing.filter((m) => m.id !== ctx.editing?.id);
      if (findDuplicateByVideoId(others, videoId, getYoutubeId)) {
        return { ok: false, message: t.alerts.duplicateUrl };
      }

      if (!isValidEquipment(ctx.equipment, ctx.form.manufacturer, ctx.form.series, ctx.form.model)) {
        return { ok: false, message: '登録されていない撮影機器の組み合わせです。' };
      }

      setLoading(true);
      try {
        // 動画情報は必須。地名は取れなくても保存は止めない（日次の再生成で補う）
        const [metaResult, placeResult] = await Promise.allSettled([
          video.fetchMeta(videoId),
          geocode.reverse(Number(ctx.form.lat), Number(ctx.form.lng)),
        ]);
        if (metaResult.status === 'rejected') return { ok: false, message: t.alerts.fetchFail };
        const meta = metaResult.value;
        const place = placeResult.status === 'fulfilled' ? placeResult.value : null;

        if (!markerStore || !user) {
          const opened = openMarkerIssue(ctx.form, videoId, meta, place);
          if (!opened) return { ok: false, message: t.contribute.notConfigured };
          return { ok: true, message: `${t.contribute.openedTitle}\n${t.contribute.openedBody}` };
        }

        const content = contentOf(ctx.form, videoId, meta, place, ctx.editing);
        const id = ctx.editing ? ctx.editing.id : await markerStore.create(content);
        if (ctx.editing) await markerStore.update(id, content);
        return {
          ok: true,
          message: ctx.editing ? t.store.updated : t.store.saved,
          saved: localMarker(id, content, user, ctx.editing),
        };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      } finally {
        setLoading(false);
      }
    },
    [video, geocode, auth, markerStore, t],
  );

  /** 本人のマーカーを論理削除する。 */
  const remove = useCallback(
    async (marker: MarkerData): Promise<SubmitResult> => {
      if (!markerStore) return { ok: false, message: t.contribute.notConfigured };
      setLoading(true);
      try {
        await markerStore.softDelete(marker.id);
        return { ok: true, message: t.store.deleted };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      } finally {
        setLoading(false);
      }
    },
    [markerStore, t],
  );

  return { submit, remove, loading, usesStore: markerStore !== null };
}
