/**
 * 公開プロフィールの YouTube チャンネル（T55・ADR 0029）。入力された URL を、保存する形（UC… か @ハンドル）にする。
 * 形の検査はルールの validChannel と同じ。受け付けるのは youtube.com/channel/UC… と youtube.com/@ハンドル だけ。
 */

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE = /^@[^\s/?#@%\\\p{Cc}\p{Cf}]{3,30}$/u;

/** 保存する形として正しいか（ルールの validChannel と同じ）。 */
export function isValidChannel(value: string): boolean {
  return CHANNEL_ID.test(value) || HANDLE.test(value);
}

/**
 * 入力（URL・UC…・@ハンドル）を保存する形にする。読めなければ null。
 * 例: https://www.youtube.com/@loca_ch/videos → @loca_ch、youtube.com/channel/UCxxxx → UCxxxx
 */
export function parseChannelInput(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (isValidChannel(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/^(www\.|m\.)?youtube\.com$/i.test(url.hostname)) return null;
  const [first, second] = url.pathname.split('/').filter(Boolean);
  const value = first === 'channel' ? second ?? '' : decodeURIComponent(first ?? '');
  return isValidChannel(value) ? value : null;
}

/** 表示と入力欄に出す URL。 */
export function channelUrl(channel: string): string {
  return channel.startsWith('@') ? `https://www.youtube.com/${channel}` : `https://www.youtube.com/channel/${channel}`;
}
