/**
 * 利用者プロフィールのドメイン型（要件 1.1・2.5・2.6・ADR 0019）。
 *
 * uid は Firebase Auth の uid で、Google アカウントに紐づく。
 * 持つのはニックネームと同意の記録だけ。メールや Google の表示名（本名のことが多い）は保存しない。
 */
export interface UserProfile {
  uid: string;
  /** 投稿者名として公開する名前。1〜20 字 */
  nickname: string;
  /** 同意した文面の版（CONSENT_VERSION）。文面を変えたら上げて、同意を取り直す */
  consentVersion: number;
  /** 同意した日時（epoch ms） */
  agreedAt: number;
  /** 登録日（epoch ms） */
  createdAt: number;
  updatedAt: number;
  /** 自己申告の YouTube チャンネル（UC… か @ハンドル。T55・ADR 0029）。未登録なら無い */
  channel?: string;
}
