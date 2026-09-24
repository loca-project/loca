/**
 * プロフィールの入力の決まり（ADR 0019）。値は rules/40-users.rules の validNickname・consentVersion と同じにすること。
 */

/** 同意の文面の版。文面を変えたら上げ、ルールの consentVersion も合わせる */
export const CONSENT_VERSION = 1;

/** 同意の項目。すべてに印が付くまで登録できない（要件 2.5.3）。文言は i18n の profile.consents に持つ */
export const CONSENT_KEYS = ['rights', 'onSite', 'data'] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export const NICKNAME_MAX = 20;

/** 前後の空白を落とし、改行を空白にする（保存する形）。 */
export function normalizeNickname(input: string): string {
  return input.replace(/[\r\n]+/g, ' ').trim();
}

/** 保存できるニックネームか（normalizeNickname のあとの値で判定する）。文字数は UTF-16 の長さで数える（絵文字は 2。ルールの size() と同じか厳しい側） */
export function isValidNickname(nickname: string): boolean {
  return nickname.length >= 1 && nickname.length <= NICKNAME_MAX && nickname === normalizeNickname(nickname);
}
