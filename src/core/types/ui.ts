/** 画面モードなど、UI 状態のドメイン型。 */

/** サイドメニューのタブ。 */
export enum TabMode {
  MAP = 'MAP',
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

/** 機器定義（メーカー → シリーズ → モデル）。 */
export interface EquipmentDef {
  manufacturer: string;
  series: Array<{ name: string; models: string[] }>;
}

