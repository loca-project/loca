/**
 * Firestore の REST API を未ログインで読む（ルールで誰でも読めるコレクションだけ）。
 * Admin SDK とサービスアカウントの鍵を使わないので、Actions に秘密情報を置かなくてよい。
 */

/** REST の型付きの値を素の JS の値にする。時刻は epoch ms。 */
export function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return fromFields(v.mapValue.fields ?? {});
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue);
  throw new Error(`扱えない値の型です: ${Object.keys(v).join(',')}`);
}

/**
 * 項目名の順に並べて返す。REST は入れ子の項目（tags など）の順を毎回変えて返すため、
 * そのまま書くと中身が同じでも markers.json が「変更あり」になり、毎日コミットが増える。
 */
export function fromFields(fields) {
  return Object.fromEntries(
    Object.keys(fields).sort().map((k) => [k, fromValue(fields[k])]),
  );
}

/** コレクションを全件読む（ページ送りあり）。 */
export async function listCollection(config, collection) {
  const rows = [];
  let pageToken = '';
  do {
    const url = new URL(`${config.base}/${collection}`);
    url.searchParams.set('pageSize', '300');
    url.searchParams.set('key', config.apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${collection} を読めませんでした（HTTP ${res.status}）`);
    const body = await res.json();
    for (const doc of body.documents ?? []) {
      rows.push({ id: doc.name.split('/').pop(), ...fromFields(doc.fields ?? {}) });
    }
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return rows;
}
