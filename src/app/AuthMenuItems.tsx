/**
 * 右上メニューの最上段に出すログイン・ログアウト（要件 1.1）。
 * Firebase の設定が無い構成では何も出さない。
 * プロフィールと管理者モードの項目は、それぞれの画面を作るときにここへ足す。
 */

import React from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import type { AuthState } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/components/Toast';

interface AuthMenuItemsProps {
  auth: AuthState;
  itemClassName: string;
  onDone: () => void;
}

export function UserAvatar({ photoUrl, size }: { photoUrl: string | null; size: string }) {
  if (!photoUrl) return <i className="fa-solid fa-circle-user text-base text-gray-400" />;
  // Google のプロフィール画像はリファラ付きだと 403 になることがある
  return <img src={photoUrl} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full`} />;
}

export default function AuthMenuItems({ auth, itemClassName, onDone }: AuthMenuItemsProps) {
  const { t } = useI18n();
  const toast = useToast();

  if (!auth.enabled) return null;

  const run = async (action: () => Promise<unknown>, successMessage: string | null) => {
    try {
      const result = await action();
      if (result !== false && successMessage) toast.success(successMessage);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (!auth.user) {
    return (
      <>
        <button
          type="button"
          role="menuitem"
          className={itemClassName}
          disabled={auth.busy}
          onClick={() => run(auth.signIn, t.auth.signedIn)}
        >
          <i className="fa-brands fa-google w-4 text-gray-400" />
          {t.auth.signIn}
        </button>
        <div className="my-1 border-t border-gray-100" />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <UserAvatar photoUrl={auth.user.photoUrl} size="h-6 w-6" />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-gray-700">{auth.user.displayName}</p>
          {auth.user.email && <p className="truncate text-[10px] text-gray-400">{auth.user.email}</p>}
        </div>
      </div>
      <button
        type="button"
        role="menuitem"
        className={itemClassName}
        disabled={auth.busy}
        onClick={() => run(auth.signOut, t.auth.signedOut)}
      >
        <i className="fa-solid fa-right-from-bracket w-4 text-gray-400" />
        {t.auth.signOut}
      </button>
      <div className="my-1 border-t border-gray-100" />
    </>
  );
}
