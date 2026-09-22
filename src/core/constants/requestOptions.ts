/** 撮影リクエストの選択肢。 */
export const UNSELECTED = '未選択';

export const REQUEST_OPTIONS = {
  timeOfDay: [UNSELECTED, '日の出', '朝', '昼', '夕方', '夜'],
  atmosphere: [UNSELECTED, '空撮/景観', '訪問/地域紹介', '散策'],
  season: [UNSELECTED, '春', '夏', '秋', '冬'],
};

/** 熱量の選択肢（1〜5）。 */
export const HEAT_LEVELS = [1, 2, 3, 4, 5];
