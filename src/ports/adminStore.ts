import type { Adapter } from './common';

/** 定期処理の記録 1 件（Firestore の jobs/{id}。Actions が書く。ADR 0017・0021）。 */
export interface JobRecord {
  /** youtube-refresh・purge-deleted など */
  id: string;
  /** 最後に動いた日時（epoch ms。不明なら 0） */
  ranAt: number;
  /** 件数などの数値の項目 */
  values: Record<string, number>;
}

/** ユーザー管理の 1 行（要件 5.2.4。T59）。メールと Google の名前は保存していないので、ニックネームと uid で見分ける（ADR 0019）。 */
export interface AdminUserRow {
  uid: string;
  /** プロフィールが無い（削除済み・未登録）なら null */
  nickname: string | null;
  /** 登録日（epoch ms。プロフィールが無ければ 0） */
  createdAt: number;
}

/** ユーザー管理の 3 区画。 */
export interface AdminUserLists {
  admins: AdminUserRow[];
  /** プロフィールのある人のうち、管理者とブラックリストを除いた人（登録日の新しい順） */
  users: AdminUserRow[];
  blacklist: AdminUserRow[];
}

/**
 * 管理者モードのポート（要件 5・T27）。
 * ここでの判定は表示の切り替えにだけ使う。権限はセキュリティルール（admins/{uid}）が守る。
 * 管理者だけの操作を一般の利用者が呼ぶと UpstreamError。
 */
export interface AdminStorePort extends Adapter {
  /** ログイン中の人が管理者か（admins/{uid} があるか）。未ログインなら false。 */
  amIAdmin(): Promise<boolean>;
  /** ログイン中の人がブラックリストにいるか（本人は自分の行だけ読める。T59）。未ログインなら false。 */
  amIBlacklisted(): Promise<boolean>;
  /** 定期処理の記録。管理者だけ。 */
  jobs(): Promise<JobRecord[]>;
  /** ユーザー管理の 3 区画を Firestore から読み直す（要件 5.2.4 の「ユーザー情報の取得」）。管理者だけ。 */
  users(): Promise<AdminUserLists>;
  /** 利用者のプロフィールと名前の索引を消す。マーカーは消さない（マーカー管理で個別に論理削除。T59 の判断）。 */
  deleteUser(uid: string): Promise<void>;
  /** ブラックリストに入れる。次のログインで止まり、書き込みはルールが拒否する。 */
  blacklist(uid: string): Promise<void>;
  /** ブラックリストから外す。 */
  unblacklist(uid: string): Promise<void>;
  /**
   * マーカーをまとめて論理削除し、動画の索引を外す（禁止の印が付いた索引は残す）。要件 5.2.5・T60。
   * 物理削除は 30 日後に Actions が行う（ADR 0021）。消した件数を返す（削除済みは数えない）。
   */
  softDeleteMarkers(ids: string[]): Promise<number>;
  /**
   * ほかの人の撮影リクエストを 1 件取り下げる（論理削除）。持ち主の熱量の印を同じバッチで減らすので、熱量はその分戻る。
   * 印は 1 件ずつしか動かせない（ルール）ので、まとめて取り下げるときは呼び出し側が順に呼ぶ。
   */
  withdrawRequest(entry: { id: string; heat: number; ownerUid: string }): Promise<void>;
}
