/** 入力バリデーション。UI にもバッチにも使えるよう純関数で持つ。 */

import type { EmotionTags, MarkerDraft } from '@/core/types';
import { isValidYoutubeUrl } from './youtube';

export interface ValidationIssue {
  field: string;
  /** i18n キー */
  messageKey: string;
}

export function validateLat(value: string | number): boolean {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function validateLng(value: string | number): boolean {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

export function hasAllTags(tags: Partial<EmotionTags>): tags is EmotionTags {
  return Boolean(tags.action && tags.atmosphere && tags.emotion);
}

/** 登録・更新前の一括チェック。空配列なら妥当。 */
export function validateMarkerDraft(draft: Partial<MarkerDraft>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!draft.youtubeUrl || !isValidYoutubeUrl(draft.youtubeUrl)) {
    issues.push({ field: 'youtubeUrl', messageKey: 'invalidUrl' });
  }
  if (!validateLat(draft.lat ?? NaN)) {
    issues.push({ field: 'lat', messageKey: 'invalidCoord' });
  }
  if (!validateLng(draft.lng ?? NaN)) {
    issues.push({ field: 'lng', messageKey: 'invalidCoord' });
  }
  if (!hasAllTags(draft.tags ?? {})) {
    issues.push({ field: 'tags', messageKey: 'missingTags' });
  }
  return issues;
}
