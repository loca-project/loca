/**
 * 検索・ランキングのフィルタ条件。
 *
 * Google API を使わない決定により、再生数・動画投稿日・再生時間は取得できない。
 * そのため基準を Loca 内の指標（登録日・登録件数）に置き換えている。
 * 元の要件 4.1/4.2 の「再生数順」「投稿日フィルタ」「長さフィルタ」はこの置き換えで代替する。
 */

import type { TagField } from '@/core/constants/tags';

/**
 * タグの絞り込み。項目の中は OR、項目の間は AND（要件 4.2・ADR 0015）。
 * 未定義・空配列の項目では絞らない。値はタグのキー。
 */
export type TagSelection = Partial<Record<TagField, string[]>>;

/** Loca への登録日を基準にした期間フィルタ。 */
export type PeriodFilter = 'all' | '1y' | '6m' | '3m' | '1m' | '2w' | 'today';
export type SeasonFilter = '1-3' | '4-6' | '7-9' | '10-12';
export type ResultLimit = 30 | 20 | 10;

export interface RankingFilter {
  /** 登録日の範囲 */
  period: PeriodFilter;
  limit: ResultLimit;

  prefecture?: string;
  /** 登録月を四半期で絞る */
  season?: SeasonFilter;

  /** 撮影リクエストランキング専用 */
  timeOfDay?: string;
  atmosphere?: string;

  equipment?: {
    manufacturer: string;
    series: string;
    model: string;
  };

  /** タグ（複数選択可） */
  tags: TagSelection;
}

export const DEFAULT_RANKING_FILTER: RankingFilter = {
  period: 'all',
  limit: 30,
  tags: {},
};

/** 1 画面に載せる上限。これを超える分はフィルタで絞ってもらう。 */
export const RANKING_BASE_LIMIT = 100;

/** チャンネル別ランキングの 1 行。 */
export interface ChannelRankingRow {
  channelTitle: string;
  videoCount: number;
  /** 最後に登録された時刻 */
  latestAt: number;
  /** 代表マーカー（地図ジャンプ用） */
  sampleMarkerId: string;
  lat: number;
  lng: number;
}

/** 地域別・機器別ランキングの 1 行（件数で競う）。 */
export interface GroupRankingRow {
  label: string;
  count: number;
  latestAt: number;
  sampleMarkerId: string;
  lat: number;
  lng: number;
}
