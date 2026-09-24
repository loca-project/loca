/**
 * プロフィールの登録画面と編集画面を出し分ける（要件 1.1・ADR 0019）。
 * ログイン済みで未登録なら登録画面を必ず出す。登録かキャンセル（ログアウト）のどちらかを選ぶまで閉じない。
 * アカウント削除（ADR 0021）の確認と実行もここで扱う。削除の途中でプロフィールが消えても、登録画面を割り込ませない。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { interpolate } from '@/core/logic/format';
import { useAuth } from '@/shared/hooks/useAuth';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useProfile } from '@/shared/hooks/useProfile';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import RegisterModal from './RegisterModal';
import ProfileModal from './ProfileModal';
import DeleteAccountModal from './DeleteAccountModal';
import { useCloseAccount } from './useCloseAccount';

export default function ProfileGate() {
  const { profileStore } = useServices();
  const auth = useAuth();
  const { status, profile, editorOpen, setEditorOpen } = useProfile();
  const { t } = useI18n();
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const closeAccount = useCloseAccount();
  /** アカウント削除の確認を出しているか、実行中か */
  const [deletion, setDeletion] = useState<'confirm' | 'running' | null>(null);

  useEffect(() => {
    if (status === 'error') toast.error(t.profile.loadFailed);
  }, [status, toast, t]);

  // ログインごとに 1 回、名前の索引の取り直しと、投稿者名がずれたマーカーの修復をする（ADR 0019 決定 7・9）。
  // 名前の変更は rename 自身がそろえるので、変更のたびには走らせない
  const aligned = useRef('');
  useEffect(() => {
    if (!profileStore || !profile) return;
    if (aligned.current === profile.uid) return;
    aligned.current = profile.uid;
    profileStore
      .repair(profile.nickname)
      .then((count) => {
        if (count > 0) toast.info(interpolate(t.profile.aligned, { count }));
      })
      .catch((e: unknown) => {
        console.error('[loca] 投稿者名をそろえられませんでした', e);
        toast.error(e instanceof Error ? e.message : String(e));
      });
  }, [profileStore, profile, toast, t]);

  /** 保存して、成功したら done を知らせる。失敗は理由を出す。 */
  const save = useCallback(
    (action: (nickname: string) => Promise<void>, done: string, after?: () => void) => (nickname: string) =>
      void exclusive(async () => {
        try {
          await action(nickname);
          toast.success(done);
          after?.();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e));
        }
      }),
    [exclusive, toast],
  );

  const cancel = useCallback(async () => {
    try {
      await auth.signOut();
      toast.info(t.auth.signedOut);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [auth, toast, t]);

  const runDeletion = useCallback(async () => {
    setDeletion('running');
    try {
      const result = await closeAccount();
      if (!result) {
        setDeletion('confirm'); // 本人確認を閉じた
        return;
      }
      setDeletion(null);
      setEditorOpen(false);
      toast.success(interpolate(t.profile.deletion.done, { markers: result.markers, requests: result.requests }));
    } catch (e) {
      console.error('[loca] アカウントを削除できませんでした', e);
      setDeletion('confirm');
      toast.error(interpolate(t.profile.deletion.failed, { message: e instanceof Error ? e.message : String(e) }));
    }
  }, [closeAccount, setEditorOpen, toast, t]);

  if (!profileStore) return null;

  if (deletion) {
    return (
      <DeleteAccountModal
        busy={deletion === 'running'}
        onConfirm={() => void runDeletion()}
        onCancel={() => setDeletion(null)}
      />
    );
  }

  if (status === 'missing') {
    return (
      <RegisterModal
        busy={loading || auth.busy}
        onRegister={save((n) => profileStore.register(n), t.profile.registered)}
        onCancel={() => void cancel()}
      />
    );
  }

  if (editorOpen && profile && auth.user) {
    return (
      <ProfileModal
        profile={profile}
        user={auth.user}
        busy={loading}
        onSave={save((n) => profileStore.rename(n), t.profile.updated, () => setEditorOpen(false))}
        onClose={() => setEditorOpen(false)}
        onDelete={() => setDeletion('confirm')}
      />
    );
  }
  return null;
}
