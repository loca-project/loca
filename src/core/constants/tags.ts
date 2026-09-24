/**
 * タグの定義（要件 3.3・ADR 0014）。UI の並び順・ルールの一覧・訳語はここが唯一の情報源。
 * 値は英小文字のキーで保存し、表示は ja / en の語に置き換える。
 * キーを変えたら firestore.rules の validTags も同じにすること。
 */

export const SUBJECT_KEYS = ['nature', 'townscape', 'festival', 'food', 'transport', 'heritage', 'life'] as const;
export const MOOD_KEYS = ['lively', 'calm', 'dreamy', 'grand', 'nostalgic', 'thrill'] as const;
export const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const TIME_OF_DAY_KEYS = ['sunrise', 'morning', 'daytime', 'evening', 'night'] as const;
export const STYLE_KEYS = ['aerial', 'walking', 'vehicle', 'fixed'] as const;

export type SubjectKey = (typeof SUBJECT_KEYS)[number];
export type MoodKey = (typeof MOOD_KEYS)[number];
export type SeasonKey = (typeof SEASON_KEYS)[number];
export type TimeOfDayKey = (typeof TIME_OF_DAY_KEYS)[number];
export type StyleKey = (typeof STYLE_KEYS)[number];

/** タグの項目名。MarkerTags のキーと同じ。 */
export type TagField = 'subject' | 'mood' | 'season' | 'timeOfDay' | 'style';

export interface TagOption {
  key: string;
  ja: string;
  en: string;
}

export interface TagCategory {
  field: TagField;
  required: boolean;
  options: TagOption[];
}

const LABELS: Record<string, [string, string]> = {
  nature: ['自然・景色', 'Nature & scenery'],
  townscape: ['街並み・建物', 'Streets & buildings'],
  festival: ['祭り・イベント', 'Festivals & events'],
  food: ['食', 'Food'],
  transport: ['乗り物・交通', 'Transport'],
  heritage: ['史跡・文化', 'History & culture'],
  life: ['暮らし・人', 'Everyday life'],
  lively: ['賑やか', 'Lively'],
  calm: ['穏やか', 'Calm'],
  dreamy: ['幻想的', 'Dreamy'],
  grand: ['壮大', 'Grand'],
  nostalgic: ['懐かしい', 'Nostalgic'],
  thrill: ['スリル', 'Thrilling'],
  spring: ['春', 'Spring'],
  summer: ['夏', 'Summer'],
  autumn: ['秋', 'Autumn'],
  winter: ['冬', 'Winter'],
  sunrise: ['日の出', 'Sunrise'],
  morning: ['朝', 'Morning'],
  daytime: ['昼', 'Daytime'],
  evening: ['夕方', 'Evening'],
  night: ['夜', 'Night'],
  aerial: ['空撮', 'Aerial'],
  walking: ['歩き撮り', 'Walking'],
  vehicle: ['車載・乗車', 'From a vehicle'],
  fixed: ['定点', 'Fixed camera'],
};

const options = (keys: readonly string[]): TagOption[] =>
  keys.map((key) => ({ key, ja: LABELS[key][0], en: LABELS[key][1] }));

/** 要件 3.3 の UI 配置順（必須 → 任意）。 */
export const TAG_CATEGORIES: TagCategory[] = [
  { field: 'subject', required: true, options: options(SUBJECT_KEYS) },
  { field: 'mood', required: true, options: options(MOOD_KEYS) },
  { field: 'season', required: false, options: options(SEASON_KEYS) },
  { field: 'timeOfDay', required: false, options: options(TIME_OF_DAY_KEYS) },
  { field: 'style', required: false, options: options(STYLE_KEYS) },
];

export const TAG_FIELDS: TagField[] = TAG_CATEGORIES.map((c) => c.field);

/** キーの表示名。知らないキーはそのまま返す（壊れたデータでも画面を落とさない）。 */
export function tagLabel(key: string | undefined, lang: 'ja' | 'en'): string {
  if (!key) return '';
  const pair = LABELS[key];
  if (!pair) return key;
  return lang === 'ja' ? pair[0] : pair[1];
}

/** 現地メモの最大文字数（firestore.rules の validMemo と同じ）。 */
export const MEMO_MAX_LENGTH = 80;
