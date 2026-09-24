/**
 * 自分が行った削除・取り下げを、地図の一覧（useCatalog）にすぐ映すための知らせ。
 *
 * 差分の購読（onSnapshot）は書き込みがサーバーで確定してから届くので、それを待つと、
 * 消したマーカーが地図や一覧に残り、もう一度削除できてしまう。削除した画面はここに知らせ、一覧が先に外す。
 * あとから購読で同じ変更が届いても、同じ ID を外すだけなので結果は変わらない。
 */

export type LocalChange =
  /** 論理削除したマーカー */
  | { kind: 'markers'; ids: string[] }
  /** 取り下げた撮影リクエスト（1 件ずつの ID） */
  | { kind: 'requestEntries'; ids: string[] }
  /** アカウント削除などで、その人のマーカーと撮影リクエストをすべて外す */
  | { kind: 'owner'; uid: string };

const listeners = new Set<(change: LocalChange) => void>();

export function publishLocalChange(change: LocalChange): void {
  listeners.forEach((l) => l(change));
}

/** 解除する関数を返す。 */
export function onLocalChange(listener: (change: LocalChange) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
