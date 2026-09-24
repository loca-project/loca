/** 表示整形。ロケール差で壊れないよう用途を限定して持つ。 */

export function formatCount(n?: number): string {
  if (n == null) return '-';
  return n.toLocaleString('ja-JP');
}

export function formatDate(value?: string | number): string {
  if (!value) return '-';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateTime(value?: string | number): string {
  if (!value) return '-';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(d.getTime())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 秒を 4:13 や 1:02:03 の形にする。 */
export function formatDuration(sec?: number): string {
  if (sec == null) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** テンプレート中の {key} を置換する。i18n の簡易差し込み用。 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/**
 * 公開する投稿者名。プロフィール（ニックネーム）が実装されるまでは uid から作る仮の名前にする。
 * Google の表示名は本名のことが多く、誰でも読める markers に載せないため（要件 1.1 プライバシー）。
 */
export function pseudonymOf(uid: string): string {
  return `user-${uid.slice(0, 6)}`;
}