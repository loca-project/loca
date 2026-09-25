/**
 * プロフィールの登録画面と編集画面を出し分ける（要件 1.1・ADR 0019）。
 * ログイン済みで未登録なら登録画面を必ず出す。登録かキャンセル（ログアウト）のどちらかを選ぶまで閉じない。
 * アカウント削除（ADR 0021）の確認と実行もここで扱う。削除の途中でプロフィールが消えても、登録画面を割り込ませない。
 * ブラックリストの人は、登録画面を出す前にログアウトさせ、案内を出す（要件 5.2.4・T59）。
 */

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { interpolate } from '@/core/logic/format';
import { useAuth } from '@/shared/hooks/useAuth';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useProfile } from '@/shared/hooks/useProfile';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';
import Modal from '@/shared/components/Modal';
import { Button } from '@/shared/components/Controls';
import { useCloseAccount } from './useCloseAccount';

// 登録・プロフィール・アカウント削除の画面は、ログインして出すときに読み込む（初期読み込みの JS を減らす。T62）
const RegisterModal = lazy(() => import('./RegisterModal'));
const ProfileModal = lazy(() => import('./ProfileModal'));
const DeleteAccountModal = lazy(() => import('./DeleteAccountModal'));

export default function ProfileGate() {
  return (
    <Suspense fallback={null}>
      <ProfileGateBody />
    </Suspense>
  );
}

function ProfileGateBody() {
  const { profileStore } = useServices();
  const auth = useAuth();
  const { status, profile, editorOpen, setEditorOpen } = useProfile();
  const { t } = useI18n();
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const closeAccount = useCloseAccount();
  /** アカウント削除の確認を出しているか、実行中か */
  const [deletion, setDeletion] = useState<'confirm' | 'running' | null>(null);
  /** ブラックリストでログアウトさせたあとの案内を出しているか */
  const [blockedNotice, setBlockedNotice] = useState(false);
  /** 公開プロフィールの YouTube チャンネル（T55）。プロフィール画面を開いたときに読む。undefined は読み込み中 */
  const [channel, setChannel] = useState<string | null | undefined>(undefined);
  const uid = auth.user?.uid ?? null;
  useEffect(() => {
    if (!editorOpen || !profileStore || !uid) {
      setChannel(undefined);
      return undefined;
    }
    let cancelled = false;
    profileStore
      .channelOf(uid)
      .then((c) => !cancelled && setChannel(c))
      .catch((e: unknown) => {
        // 読めなくてもプロフィールは直せるようにする（チャンネル欄は空で出す）
        console.warn('[loca] チャンネルを読めませんでした', e);
        if (!cancelled) setChannel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [editorOpen, profileStore, uid]);

  const { signOut } = auth;
  useEffect(() => {
    if (status !== 'blocked') return;
    setBlockedNotice(true);
    signOut().catch((e: unknown) => console.error('[loca] ログアウトできませんでした', e));
  }, [status, signOut]);

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

  if (blockedNotice) {
    return (
      <Modal
        open
        title={t.admin.blocked.title}
        onClose={() => setBlockedNotice(false)}
        footer={<Button onClick={() => setBlockedNotice(false)}>{t.admin.blocked.ok}</Button>}
      >
        <p className="text-xs leading-relaxed text-gray-700">{t.admin.blocked.body}</p>
      </Modal>
    );
  }

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

  // チャンネルを読み終えてから出す（入力欄の初期値にするため）
  if (editorOpen && profile && auth.user && channel !== undefined) {
    return (
      <ProfileModal
        profile={profile}
        channel={channel}
        user={auth.user}
        busy={loading}
        onSave={(changes) =>
          void exclusive(async () => {
            try {
              // ニックネーム（投稿者名の追従を含む）→ チャンネルの順に、変えたものだけを書く
              if (changes.nickname !== null) await profileStore.rename(changes.nickname);
              if (changes.channel !== null) await profileStore.setChannel(changes.channel || null);
              toast.success(t.profile.updated);
              setEditorOpen(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e));
            }
          })
        }
        onClose={() => setEditorOpen(false)}
        onDelete={() => setDeletion('confirm')}
      />
    );
  }
  return null;
}
