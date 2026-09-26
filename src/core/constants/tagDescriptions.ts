/**
 * AI 検索でタグと検索語の意味を比べるための、タグの説明文（ADR 0033）。モデルには日本語と英語を 1 文に並べて渡す。
 * ラベル（tags.ts）だけだと手がかりが少なく、1 位の正解が日本語 88%・英語 69% だった（Node の 4 ビット版。未使用の問題 32 問）。
 * 説明を足すと日本語 94%・英語 75%（同）。ブラウザで使う model_no_gather では日本語 94%・英語 72%（2026-09-26。npm run semantic:eval）。
 * 試験問題の語をそのまま入れない（点が水増しされる）。変えたら npm run semantic:eval で採点し直す。
 */

import type { TagField } from './tags';

interface TagDescription {
  field: TagField;
  ja: string;
  en: string;
}

export const TAG_DESCRIPTIONS: Record<string, TagDescription> = {
  nature: {
    field: 'subject',
    ja: '映っているもの: 自然・景色。山、川、湖、森、花、空などの自然の風景',
    en: 'Subject: Nature & scenery. Mountains, rivers, lakes, forests, flowers, sky and natural landscapes',
  },
  townscape: {
    field: 'subject',
    ja: '映っているもの: 街並み・建物。都市、町、通り、建築、ビルなどの街の景観',
    en: 'Subject: Streets & buildings. Cities, towns, streets, architecture and urban views',
  },
  festival: {
    field: 'subject',
    ja: '映っているもの: 祭り・イベント。祭礼、行事、パレード、催し、コンサート',
    en: 'Subject: Festivals & events. Traditional festivals, celebrations, parades, concerts and events',
  },
  food: {
    field: 'subject',
    ja: '映っているもの: 食。料理、グルメ、食べ歩き、飲食店',
    en: 'Subject: Food. Dishes, local cuisine, restaurants and eating out',
  },
  transport: {
    field: 'subject',
    ja: '映っているもの: 乗り物・交通。鉄道、列車、バス、船、飛行機、道路、駅',
    en: 'Subject: Transport. Railways, trains, buses, ships, planes, roads and stations',
  },
  heritage: {
    field: 'subject',
    ja: '映っているもの: 史跡・文化。寺院、神社仏閣、城郭、遺跡、伝統文化、歴史的な建造物',
    en: 'Subject: History & culture. Temples, shrines, fortresses, historic sites, traditional culture and historic buildings',
  },
  life: {
    field: 'subject',
    ja: '映っているもの: 暮らし・人。人々の日常、生活、仕事、家族、地域の営み',
    en: "Subject: Everyday life. People's daily lives, work, families, children and local community",
  },
  lively: { field: 'mood', ja: '雰囲気: 賑やか。人が多く活気がある、にぎわい', en: 'Mood: Lively. Busy, bustling, crowded and energetic' },
  calm: { field: 'mood', ja: '雰囲気: 穏やか。静か、落ち着いた、ゆったり、癒やし', en: 'Mood: Calm. Quiet, peaceful, restful and tranquil' },
  dreamy: {
    field: 'mood',
    ja: '雰囲気: 幻想的。神秘的、夢のような、光や霧が美しい',
    en: 'Mood: Dreamy. Magical, mystical, ethereal light and atmosphere',
  },
  grand: { field: 'mood', ja: '雰囲気: 壮大。スケールが大きい、雄大、圧倒される景色', en: 'Mood: Grand. Vast, majestic and awe-inspiring scale' },
  nostalgic: { field: 'mood', ja: '雰囲気: 懐かしい。昔ながら、レトロ、古き良き', en: 'Mood: Nostalgic. Old-fashioned, retro and sentimental' },
  thrill: {
    field: 'mood',
    ja: '雰囲気: スリル。恐怖、ハラハラする、危険、迫力',
    en: 'Mood: Thrilling. Exciting, frightening, dangerous and adrenaline-filled',
  },
  spring: { field: 'season', ja: '撮影の季節: 春（3〜5 月）', en: 'Season: Spring (March to May)' },
  summer: { field: 'season', ja: '撮影の季節: 夏（6〜8 月）', en: 'Season: Summer (June to August)' },
  autumn: { field: 'season', ja: '撮影の季節: 秋（9〜11 月）', en: 'Season: Autumn, fall (September to November)' },
  winter: { field: 'season', ja: '撮影の季節: 冬（12〜2 月）', en: 'Season: Winter (December to February)' },
  sunrise: { field: 'timeOfDay', ja: '撮影の時間帯: 日の出。夜明け、太陽が昇るころ', en: 'Time of day: Sunrise. Daybreak, when the sun comes up' },
  morning: { field: 'timeOfDay', ja: '撮影の時間帯: 朝。午前中', en: 'Time of day: Morning. The hours before noon' },
  daytime: { field: 'timeOfDay', ja: '撮影の時間帯: 昼。日中、正午から午後', en: 'Time of day: Daytime. Midday and afternoon' },
  evening: { field: 'timeOfDay', ja: '撮影の時間帯: 夕方。日没、夕暮れ、たそがれ', en: 'Time of day: Evening. Dusk, twilight, sundown' },
  night: { field: 'timeOfDay', ja: '撮影の時間帯: 夜。暗くなってから、夜間', en: 'Time of day: Night. After dark, nighttime' },
  aerial: { field: 'style', ja: '撮り方: 空撮。ドローンや上空から撮った映像', en: 'Shooting style: Aerial. Filmed from the air, for example by drone' },
  walking: { field: 'style', ja: '撮り方: 歩き撮り。歩きながら撮影、散策', en: 'Shooting style: Walking. Filmed while walking or strolling' },
  vehicle: {
    field: 'style',
    ja: '撮り方: 車載・乗車。車、電車、自転車などに乗って撮影',
    en: 'Shooting style: From a vehicle. Filmed from a car, train, bicycle or other vehicle',
  },
  fixed: {
    field: 'style',
    ja: '撮り方: 定点。三脚などで固定したカメラで同じ場所から撮り続ける',
    en: 'Shooting style: Fixed camera. Camera on a tripod filming from one spot',
  },
};

/** モデルに渡すタグの文書（日本語と英語を並べる。採点のときと同じ形） */
export function tagDocument(key: string): string {
  const d = TAG_DESCRIPTIONS[key];
  return d ? `${d.ja} / ${d.en}` : key;
}
