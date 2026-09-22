/** YouTube URL の解析。外部依存なしの純関数。 */

const YT_ID_PATTERN =
  /(?:youtu\.be\/|\/v\/|\/u\/\w\/|\/embed\/|watch\?v=|&v=|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/;

/** URL から動画 ID を取り出す。取り出せなければ null。 */
export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(YT_ID_PATTERN);
  if (match) return match[1];
  // ID そのものを渡された場合も受け付ける
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export function isValidYoutubeUrl(url: string): boolean {
  return getYoutubeId(url) !== null;
}

/** 正規化した視聴 URL。重複判定は ID で行うため、保存値は表示用。 */
export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** サムネイルは API を介さず直接取得できる。 */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/** 埋め込みプレイヤーの URL。youtube-nocookie でトラッキングを抑える。 */
export function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
