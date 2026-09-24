/**
 * 画面右上。左から「メニュー（≡）」と「アカウント」の丸いボタンを並べる。
 *
 * - メニュー: 統計・投稿の流れ・言語だけ。迷わせないよう項目を絞る（リポジトリやデータの生成日時は出さない）。
 * - アカウント: 未ログインなら「ログイン」、ログイン後は Google のような丸いアイコンだけ。
 *   押すと名前・メール・ログアウトを出す。プロフィールと管理者モードはここに足す。
 * - Firebase の設定が無い構成では、アカウントのボタン自体を出さない。
 */

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/components/Toast';
import { Button, IconButton } from '@/shared/components/Controls';

interface HeaderBarProps {
  onOpenStats: () => void;
  onOpenGuide: () => void;
}

type Popup = 'menu' | 'account' | null;

const PANEL = 'absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-xl';
const ITEM = 'flex h-9 w-full items-center gap-2.5 px-3 text-left text-xs text-gray-700 hover:bg-gray-100';
/** 地図の上に浮かせる丸いボタンの共通の見た目 */
const FLOATING = 'border border-gray-200 bg-white shadow-md';

function Avatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  if (photoUrl) {
    // Google のプロフィール画像はリファラ付きだと 403 になることがある
    return <img src={photoUrl} alt={name} referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-loca-500 text-sm font-bold text-white">
      {name.slice(0, 1)}
    </span>
  );
}

export default function HeaderBar({ onOpenStats, onOpenGuide }: HeaderBarProps) {
  const { t, lang, changeLanguage } = useI18n();
  const auth = useAuth();
  const toast = useToast();
  const [popup, setPopup] = useState<Popup>(null);
  const ref = useRef<HTMLDivElement>(null);

  // 外側のクリック、または Esc で閉じる
  useEffect(() => {
    if (!popup) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPopup(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPopup(null);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [popup]);

  const toggle = (next: Exclude<Popup, null>) => setPopup((p) => (p === next ? null : next));
  const choose = (action: () => void) => () => {
    setPopup(null);
    action();
  };
  const run = async (action: () => Promise<unknown>, done: string) => {
    setPopup(null);
    try {
      if ((await action()) !== false) toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div ref={ref} className="absolute right-4 top-4 z-40 flex items-center gap-2">
      <div className="relative">
        <IconButton
          icon="fa-solid fa-bars"
          label={t.menu.label}
          aria-haspopup="menu"
          aria-expanded={popup === 'menu'}
          className={FLOATING}
          onClick={() => toggle('menu')}
        />
        {popup === 'menu' && (
          <div role="menu" className={PANEL}>
            <button type="button" role="menuitem" className={ITEM} onClick={choose(onOpenStats)}>
              <i className="fa-solid fa-chart-pie w-4 text-gray-400" />
              {t.admin.title}
            </button>
            <button type="button" role="menuitem" className={ITEM} onClick={choose(onOpenGuide)}>
              <i className="fa-solid fa-circle-question w-4 text-gray-400" />
              {t.contribute.guideTitle}
            </button>
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => changeLanguage(lang === 'ja' ? 'en' : 'ja')}
            >
              <i className="fa-solid fa-language w-4 text-gray-400" />
              {t.menu.language}
              <span className="ml-auto text-[10px] text-gray-400">{lang === 'ja' ? '日本語' : 'English'}</span>
            </button>
          </div>
        )}
      </div>

      {auth.enabled && !auth.user && (
        <Button
          pill
          className="px-4 shadow-md"
          disabled={auth.busy}
          onClick={() => run(auth.signIn, t.auth.signedIn)}
        >
          {t.auth.login}
        </Button>
      )}

      {auth.user && (
        <div className="relative">
          <button
            type="button"
            aria-label={auth.user.displayName}
            title={auth.user.displayName}
            aria-haspopup="menu"
            aria-expanded={popup === 'account'}
            onClick={() => toggle('account')}
            className="block rounded-full shadow-md ring-2 ring-white transition hover:ring-loca-200"
          >
            <Avatar photoUrl={auth.user.photoUrl} name={auth.user.displayName} />
          </button>
          {popup === 'account' && (
            <div role="menu" className={PANEL}>
              <div className="px-3 py-2">
                <p className="truncate text-xs font-bold text-gray-800">{auth.user.displayName}</p>
                {auth.user.email && <p className="truncate text-[11px] text-gray-400">{auth.user.email}</p>}
              </div>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                disabled={auth.busy}
                onClick={() => run(auth.signOut, t.auth.signedOut)}
              >
                <i className="fa-solid fa-right-from-bracket w-4 text-gray-400" />
                {t.auth.signOut}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
