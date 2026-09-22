/** 利用者プロフィールのドメイン型。 */

export type Nationality = 'Japan' | 'Other';
export type Gender = 'Male' | 'Female';
/** active: 通常 / flagged: 要注意 / blacklisted: 認証拒否 */
export type UserStatus = 'active' | 'flagged' | 'blacklisted';

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;

  nationality: Nationality;
  /** YYYY-MM-DD */
  dob: string;
  gender: Gender;

  status: UserStatus;
  isAdmin: boolean;

  /** コンテンツ利用に関する同意 */
  agreedToPolicy: boolean;
  /** 個人情報等の取得目的への同意 */
  agreedToDataUsage: boolean;
  /** 同意した日時（epoch ms） */
  agreedAt: number;

  createdAt: number;
  updatedAt?: number;
}

/** 認証基盤が返す最小限の利用者情報。プロフィール登録前でも存在しうる。 */
export interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  /** ローカルアダプタによる疑似ログインかどうか */
  isLocal: boolean;
}
