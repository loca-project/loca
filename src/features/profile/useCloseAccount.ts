/**
 * アカウント削除の手順（要件 2.7・ADR 0021）。すべて論理削除で、物理削除は 30 日後に Actions が行う（T58）。
 *
 * 1. Google で本人確認（取り消したら何もしない）
 * 2. 自分のマーカーをすべて論理削除し、動画の索引を外す
 * 3. 撮影リクエストをすべて取り下げる（熱量は戻る）
 * 4. 付けたいいねをすべて外す（件数が減る。ADR 0024）
 * 5. プロフィールと名前の索引を消す
 * 6. ログインの登録を消す（自動でログアウトになる）
 *
 * 2〜5 は、途中で失敗してももう一度実行すれば残りから続く（消し済み・取り下げ済みは飛ばす）。
 */

import { useCallback } from 'react';
import { UpstreamError } from '@/ports';
import { useServices } from '@/shared/hooks/useServices';
import { publishLocalChange } from '@/shared/localChanges';

export interface CloseAccountResult {
  markers: number;
  requests: number;
  likes: number;
}

export function useCloseAccount(): () => Promise<CloseAccountResult | null> {
  const { auth, markerStore, requestStore, likeStore, profileStore } = useServices();

  return useCallback(async () => {
    if (!auth || !markerStore || !requestStore || !likeStore || !profileStore) {
      throw new UpstreamError('この構成ではアカウントを削除できません。');
    }
    if (!(await auth.reauthenticate())) return null;
    const uid = auth.currentUser()?.uid;
    const markers = await markerStore.softDeleteAllMine();
    const requests = await requestStore.withdrawAllMine();
    const likes = await likeStore.unlikeAllMine();
    // その人の投稿を、購読を待たずに地図から外す
    if (uid) publishLocalChange({ kind: 'owner', uid });
    await profileStore.remove();
    await auth.deleteAccount();
    return { markers, requests, likes };
  }, [auth, markerStore, requestStore, likeStore, profileStore]);
}
