/** 感情タグ定義。UI の並び順もここが唯一の情報源。 */

export interface TagCategory {
  key: 'action' | 'atmosphere' | 'emotion';
  /** i18n のキー */
  labelKey: string;
  options: string[];
}

/** 要件 3.3 の UI 配置順（2→3→4）でそのまま並べている。 */
export const TAG_CATEGORIES: TagCategory[] = [
  {
    key: 'action',
    labelKey: 'tagAction',
    options: ['訪問/地域紹介', '映像制作', 'お祭り/イベント', '機器/技術紹介'],
  },
  {
    key: 'atmosphere',
    labelKey: 'tagAtmosphere',
    options: ['明るい', '真面目', '落ち着いた', '緊張', '幻想的', 'スマート'],
  },
  {
    key: 'emotion',
    labelKey: 'tagEmotion',
    options: ['喜び', '興奮', '癒し', '驚き', '恐怖', '悲しみ', '希望'],
  },
];

/** 全カテゴリの選択肢を平坦化したもの（フィルタの OR 判定に使う）。 */
export const ALL_TAG_OPTIONS: string[] = TAG_CATEGORIES.flatMap((c) => c.options);
