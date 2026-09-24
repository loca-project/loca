/** 画面モードなど、UI 状態のドメイン型。 */

/** サイドメニューのタブ。 */
export enum TabMode {
  MAP = 'MAP',
  /** 投稿（マーカーと撮影リクエスト）。このタブの間だけ地図のクリックで場所を選ぶ */
  POST = 'POST',
  RANKING_REQUEST = 'RANKING_REQUEST',
  RANKING_REGION = 'RANKING_REGION',
  RANKING_CHANNEL = 'RANKING_CHANNEL',
  RANKING_EQUIPMENT = 'RANKING_EQUIPMENT',
  REQUEST_LIST = 'REQUEST_LIST',
}

/** 地図タブ内のモード。 */
export enum MapMode {
  SEARCH = 'SEARCH',
  REGISTER = 'REGISTER',
  EDIT = 'EDIT',
  /** 撮影リクエストマーカーの閲覧 */
  REQUEST_VIEW = 'REQUEST_VIEW',
}

export type LanguageCode = 'ja' | 'en';

/** 機器マスタの 1 分類（分類 → メーカー → シリーズ → モデル。ADR 0018）。category は EquipmentCategoryKey。 */
export interface EquipmentDef {
  category: string;
  makers: Array<{ name: string; series: Array<{ name: string; models: string[] }> }>;
}

