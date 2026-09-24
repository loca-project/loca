/**
 * 画面右上のボタンは 1 つだけ。未ログインなら「ログイン」、ログイン後は Google のような丸いアイコン。
 * 押すとプルダウンに、アカウント（ログイン／名前・メール・ログアウト）とメニュー（統計・投稿の流れ・言語）を出す。
 * 迷わせないよう項目を絞る（リポジトリやデータの生成日時は出さない）。登録済みならプロフィールを出す（管理者モードは T27 で足す）。
 * 名前は登録したニックネームを出す（Google の名前は本名のことが多いため、登録前だけ使う）。
 * Firebase の設定が無い構成では「≡」の丸いボタンになり、メニューだけを出す。
 */

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAuth } from '@/shared/hooks/useAuth';
import { useProfile } from '@/shared/hooks/useProfile';
import { useToast } from '@/shared/components/Toast';

interface HeaderBarProps {
  onOpenStats: () => void;
  onOpenGuide: () => void;
}

const PANEL = 'absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-xl';
const ITEM = 'flex h-9 w-full items-center gap-2.5 px-3 text-left text-xs text-gray-700 hover:bg-gray-100';
/** 地図の上に浮かせる丸いボタンの共通の見た目 */
const FLOATING = 'shadow-md ring-2 ring-white transition hover:ring-loca-200';

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
  const { profile, setEditorOpen } = useProfile();
  const shownName = profile?.nickname ?? auth.user?.displayName ?? '';
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 外側のクリック、または Esc で閉じる
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const run = async (action: () => Promise<unknown>, done: string) => {
    setOpen(false);
    try {
      if ((await action()) !== false) toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const menuItems = (
    <>
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
    </>
  );
  const divider = <div className="my-1 border-t border-gray-100" />;

  // 右上のボタンは 1 つだけ。押すとアカウントとメニューをまとめたプルダウンを出す
  let trigger: React.ReactNode;
  if (auth.user) {
    trigger = <Avatar photoUrl={auth.user.photoUrl} name={shownName} />;
  } else if (auth.enabled) {
    trigger = (
      <span className="inline-flex h-9 items-center rounded-full bg-loca-500 px-4 text-xs font-bold text-white hover:bg-loca-600">
        {t.auth.login}
      </span>
    );
  } else {
    trigger = (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600">
        <i className="fa-solid fa-bars" />
      </span>
    );
  }

  return (
    <div ref={ref} className="absolute right-4 top-4 z-40">
      <button
        type="button"
        aria-label={auth.user ? shownName : auth.enabled ? t.auth.login : t.menu.label}
        title={auth.user ? shownName : auth.enabled ? t.auth.login : t.menu.label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`block rounded-full ${FLOATING}`}
      >
        {trigger}
      </button>

      {open && (
        <div role="menu" className={PANEL}>
          {auth.user && (
            <>
              <div className="px-3 py-2">
                <p className="truncate text-xs font-bold text-gray-800">{shownName}</p>
                {auth.user.email && <p className="truncate text-[11px] text-gray-400">{auth.user.email}</p>}
              </div>
              {profile && (
                <button type="button" role="menuitem" className={ITEM} onClick={choose(() => setEditorOpen(true))}>
                  <i className="fa-solid fa-user w-4 text-gray-400" />
                  {t.profile.menu}
                </button>
              )}
              {divider}
            </>
          )}
          {auth.enabled && !auth.user && (
            <>
              <button
                type="button"
                role="menuitem"
                className={ITEM}
                disabled={auth.busy}
                onClick={() => run(auth.signIn, t.auth.signedIn)}
              >
                <i className="fa-brands fa-google w-4 text-gray-400" />
                {t.auth.signIn}
              </button>
              {divider}
            </>
          )}
          {menuItems}
          {auth.user && (
            <>
              {divider}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}