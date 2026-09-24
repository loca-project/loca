/**
 * プロフィールの登録画面と編集画面を出し分ける（要件 1.1・ADR 0019）。
 * ログイン済みで未登録なら登録画面を必ず出す。登録かキャンセル（ログアウト）のどちらかを選ぶまで閉じない。
 */

import React, { useCallback, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useProfile } from '@/shared/hooks/useProfile';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import RegisterModal from './RegisterModal';
import ProfileModal from './ProfileModal';

export default function ProfileGate() {
  const { profileStore } = useServices();
  const auth = useAuth();
  const { status, profile, editorOpen, setEditorOpen } = useProfile();
  const { t } = useI18n();
  const toast = useToast();
  const { loading, exclusive } = useExclusive();

  useEffect(() => {
    if (status === 'error') toast.error(t.profile.loadFailed);
  }, [status, toast, t]);

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

  if (!profileStore) return null;

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
      />
    );
  }
  return null;
}
