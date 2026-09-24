/**
 * ログイン中の利用者のプロフィールを React に載せる（要件 1.1・ADR 0019）。
 * 画面全体で 1 つの購読にするため、コンテキストで配る。
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '@/core/types';
import { useAuth } from './useAuth';
import { useServices } from './useServices';

/**
 * off: ログイン機能が無い・未ログイン / loading: 読み込み中 / missing: ログイン済みで未登録（登録画面を出す）
 * ready: 登録済み / error: 読めなかった（未登録と区別する。登録画面は出さない）
 * blocked: ブラックリストにいる（登録画面を出す前にログアウトさせる。要件 5.2.4・T59）
 */
export type ProfileStatus = 'off' | 'loading' | 'missing' | 'ready' | 'error' | 'blocked';

export interface ProfileContextValue {
  status: ProfileStatus;
  profile: UserProfile | null;
  /** プロフィール画面（編集）を開いているか */
  editorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
  /** 管理者か（admins/{uid}）。表示の切り替えにだけ使う。権限はルールが守る（T27） */
  isAdmin: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { profileStore, adminStore } = useServices();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [loaded, setLoaded] = useState<{ uid: string; profile: UserProfile | null; error: boolean } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  /** ログイン中の人の権限。読み終わるまでは null（登録画面を出さずに待つ） */
  const [access, setAccess] = useState<{ uid: string; admin: boolean; blocked: boolean } | null>(null);

  // ログインの切り替えのたびに、管理者か・ブラックリストにいるかを 1 回だけ読む。
  // 読めなかったときは一般の利用者として扱う（書き込みはルールが止める）
  useEffect(() => {
    if (!adminStore || !uid) return undefined;
    let cancelled = false;
    Promise.all([adminStore.amIAdmin(), adminStore.amIBlacklisted()])
      .then(([admin, blocked]) => ({ admin, blocked }))
      .catch((e: unknown) => {
        console.error('[loca] 権限を確かめられませんでした', e);
        return { admin: false, blocked: false };
      })
      .then((result) => {
        if (!cancelled) setAccess({ uid, ...result });
      });
    return () => {
      cancelled = true;
    };
  }, [adminStore, uid]);
  const checked = !adminStore || access?.uid === uid;
  const blocked = access?.uid === uid && access.blocked;

  useEffect(() => {
    if (!profileStore || !uid) return undefined;
    return profileStore.watch(
      uid,
      (profile) => setLoaded({ uid, profile, error: false }),
      (e) => {
        console.error('[loca] プロフィールを読み込めませんでした', e);
        setLoaded({ uid, profile: null, error: true });
      },
    );
  }, [profileStore, uid]);

  // ログアウト・別アカウントへの切り替えでは、前の人の値を使わない
  const current = loaded && loaded.uid === uid ? loaded : null;
  let status: ProfileStatus = 'off';
  if (profileStore && uid) {
    if (!checked || !current) status = 'loading';
    else if (blocked) status = 'blocked';
    else if (current.error) status = 'error';
    else status = current.profile ? 'ready' : 'missing';
  }
  const profile = status === 'ready' ? (current?.profile ?? null) : null;

  const value = useMemo(
    () => ({ status, profile, editorOpen: editorOpen && status === 'ready', setEditorOpen, isAdmin: access?.uid === uid && access.admin }),
    [status, profile, editorOpen, uid, access],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile は ProfileProvider の内側でのみ使えます');
  return ctx;
}
