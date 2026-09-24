/** マーカー登録・編集フォームの状態と、ドメイン型への変換。 */

import type { Equipment, MarkerData, MarkerDraft } from '@/core/types';
import { EMPTY_EQUIPMENT } from '@/core/logic/equipment';
import { EMPTY_TAG_INPUT, normalizeMemo, toMarkerTags, toTagInput, type TagInput } from '@/core/logic/tags';

export interface MarkerFormState {
  youtubeUrl: string;
  /** 入力途中を許すため文字列で持つ */
  lat: string;
  lng: string;
  /** 撮影機器（分類 → メーカー → シリーズ → モデル。未選択は空文字） */
  equipment: Required<Equipment>;
  /** タグの選択（未選択は空文字） */
  tags: TagInput;
  /** 現地メモ（入力途中のまま持ち、保存時に整える） */
  memo: string;
}

export const EMPTY_FORM: MarkerFormState = {
  youtubeUrl: '',
  lat: '',
  lng: '',
  equipment: EMPTY_EQUIPMENT,
  tags: EMPTY_TAG_INPUT,
  memo: '',
};

export function formFromMarker(marker: MarkerData): MarkerFormState {
  return {
    youtubeUrl: marker.youtubeUrl,
    lat: String(marker.lat),
    lng: String(marker.lng),
    equipment: { ...EMPTY_EQUIPMENT, ...marker.equipment },
    tags: toTagInput(marker.tags),
    memo: marker.memo ?? '',
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
    tags: toMarkerTags(form.tags),
    memo: normalizeMemo(form.memo),
    equipment: form.equipment,
    createdBy,
    deleted: false,
    ...extras,
  };
}
