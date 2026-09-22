/** マーカー登録・編集フォームの状態と、ドメイン型への変換。 */

import type { MarkerData, MarkerDraft } from '@/core/types';

export interface MarkerFormState {
  youtubeUrl: string;
  /** 入力途中を許すため文字列で持つ */
  lat: string;
  lng: string;
  manufacturer: string;
  series: string;
  model: string;
  tagAction: string;
  tagAtmosphere: string;
  tagEmotion: string;
}

export const EMPTY_FORM: MarkerFormState = {
  youtubeUrl: '',
  lat: '',
  lng: '',
  manufacturer: '',
  series: '',
  model: '',
  tagAction: '',
  tagAtmosphere: '',
  tagEmotion: '',
};

export function formFromMarker(marker: MarkerData): MarkerFormState {
  return {
    youtubeUrl: marker.youtubeUrl,
    lat: String(marker.lat),
    lng: String(marker.lng),
    manufacturer: marker.equipment?.manufacturer ?? '',
    series: marker.equipment?.series ?? '',
    model: marker.equipment?.model ?? '',
    tagAction: marker.tags?.action ?? '',
    tagAtmosphere: marker.tags?.atmosphere ?? '',
    tagEmotion: marker.tags?.emotion ?? '',
  };
}

/** API 取得結果と合わせて保存用の形にする。座標は数値に確定させる。 */
export function draftFromForm(
  form: MarkerFormState,
  createdBy: string,
  extras: Partial<MarkerDraft> = {},
): MarkerDraft {
  return {
    youtubeUrl: form.youtubeUrl.trim(),
    lat: Number(form.lat),
    lng: Number(form.lng),
    tags: {
      action: form.tagAction,
      atmosphere: form.tagAtmosphere,
      emotion: form.tagEmotion,
    },
    equipment: {
      manufacturer: form.manufacturer,
      series: form.series,
      model: form.model,
    },
    createdBy,
    deleted: false,
    ...extras,
  };
}
