import React from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  /** 省くと閉じるボタン・Esc・背景のクリックで閉じない（必ず選ばせる画面に使う） */
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 画面幅いっぱいに近い大きさが要る管理者モードなどで指定する */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /**
   * 高さを中身によらず固定する（タブで中身が変わる画面で、タブごとに枠の高さが変わらないように）。
   * 本文は縦に並べるだけで巻き取らない。はみ出す分は、子に `min-h-0 grow overflow-y-auto` の箱を置いて巻き取る
   */
  fixedHeight?: boolean;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-5xl',
  full: 'max-w-[96rem] w-[95vw]',
};

/** 画面中央に出すオーバーレイ。Esc と背景クリックで閉じる。 */
export default function Modal({ open, title, onClose, children, footer, size = 'sm', fixedHeight = false }: ModalProps) {
  React.useEffect(() => {
    if (!open || !onClose) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex ${fixedHeight ? 'h-[90vh]' : 'max-h-[90vh]'} w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${SIZE_CLASS[size]}`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </header>

        <div className={`grow px-5 py-4 text-sm ${fixedHeight ? 'flex min-h-0 flex-col' : 'overflow-y-auto'}`}>{children}</div>

        {footer && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
