/** ログイン状態を React に載せる。auth が null（Firebase 未設定）なら enabled: false。 */

import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@/ports';
import { useServices } from './useServices';

export interface AuthState {
  /** ログイン機能が使える構成か */
  enabled: boolean;
  user: AuthUser | null;
  /** ポップアップを開いている・ログアウト中 */
  busy: boolean;
  /** 失敗したら Error を投げる（UpstreamError）。取り消しは false。 */
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const { auth } = useServices();
  const [user, setUser] = useState<AuthUser | null>(() => auth?.currentUser() ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => (auth ? auth.onChange(setUser) : undefined), [auth]);

  const signIn = useCallback(async () => {
    if (!auth) return false;
    setBusy(true);
    try {
      return (await auth.signIn()) !== null;
    } finally {
      setBusy(false);
    }
  }, [auth]);

  const signOut = useCallback(async () => {
    if (!auth) return;
    setBusy(true);
    try {
      await auth.signOut();
    } finally {
      setBusy(false);
    }
  }, [auth]);

  return { enabled: auth !== null, user, busy, signIn, signOut };
}
