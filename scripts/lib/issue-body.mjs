/**
 * GitHub Issue フォームの本文を解析する。
 *
 * Issue フォームは投稿すると Markdown 本文になり、各フィールドが
 *   ### <ラベル>
 *
 *   <値>
 * の形で並ぶ。ラベルは日本語なので、フィールド ID との対応表を渡して引き当てる。
 */

/**
 * @param {string} body Issue の本文
 * @param {Record<string,string>} labelToKey 「### の見出し」→ 取り出すキー
 * @returns {Record<string,string>}
 */
export function parseIssueForm(body, labelToKey) {
  const result = {};
  if (!body) return result;

  // 改行コードを揃えてから見出しで分割する
  const normalized = body.replace(/\r\n/g, '\n');
  const sections = normalized.split(/^### +/m).slice(1);

  for (const section of sections) {
    const newline = section.indexOf('\n');
    if (newline < 0) continue;
    const label = section.slice(0, newline).trim();
    const value = section.slice(newline + 1).trim();
    const key = labelToKey[label];
    if (!key) continue;
    // 未入力のフィールドは GitHub が _No response_ と書く
    result[key] = value === '_No response_' ? '' : value;
  }

  return result;
}

/** 数値に変換する。変換できなければ null。 */
export function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

const YT_ID_PATTERN =
  /(?:youtu\.be\/|\/v\/|\/embed\/|watch\?v=|&v=|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/;

export function getYoutubeId(url) {
  if (!url) return null;
  const match = String(url).match(YT_ID_PATTERN);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(String(url).trim())) return String(url).trim();
  return null;
}
