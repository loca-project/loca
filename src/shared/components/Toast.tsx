/** 画面下に出す一時的な通知。alert() を置き換え、操作を止めないようにする。 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'info' | 'error' | 'success';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  info: (message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLE: Record<ToastKind, string> = {
  info: 'bg-gray-800 text-white',
  error: 'bg-red-600 text-white',
  success: 'bg-emerald-600 text-white',
};

const ICON: Record<ToastKind, string> = {
  info: 'fa-circle-info',
  error: 'fa-triangle-exclamation',
  success: 'fa-circle-check',
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId;
    nextId += 1;
    setItems((prev) => [...prev, { id, kind, message }]);
    // エラーは読む時間を長めに取る
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      info: (m) => push('info', m),
      error: (m) => push('error', m),
      success: (m) => push('success', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex w-[min(92vw,30rem)] -translate-x-1/2 flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg px-4 py-2.5 text-xs shadow-lg ${STYLE[item.kind]}`}
          >
            <i className={`fa-solid ${ICON[item.kind]} mt-0.5`} />
            <span className="whitespace-pre-wrap">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast は ToastProvider の内側でのみ使えます');
  return ctx;
}
