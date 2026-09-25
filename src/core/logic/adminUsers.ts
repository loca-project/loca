/**
 * 管理者画面のユーザー管理の絞り込み（T74）。
 * 行の形はポートの AdminUserRow だが、core は ports を参照しないので、使う項目だけの形で受ける。
 */

interface UserLike {
  uid: string;
  nickname: string | null;
}

/** ニックネームか uid に query を含む行を、並びを保って返す。大文字小文字は区別しない。空の query なら全件。 */
export function usersMatching<T extends UserLike>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => (r.nickname ?? '').toLowerCase().includes(q) || r.uid.toLowerCase().includes(q));
}
