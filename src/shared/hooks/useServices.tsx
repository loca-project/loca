/**
 * サービスの解決結果を React に流し込む。
 * 解決が終わるまでは起動画面を出し、失敗したら理由を画面に出す（黙って白画面にしない）。
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Services } from '@/runtime/container';
import { getServices } from '@/runtime/container';

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<Services | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 起動の進み具合（0〜1）。分からないときは null */
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getServices((ratio) => {
      if (!cancelled && ratio !== null) setProgress(ratio);
    })
      .then((s) => {
        if (!cancelled) setServices(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
        <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500" />
        <p className="text-sm font-bold">起動に失敗しました</p>
        <p className="max-w-md text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  if (!services) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <i className="fa-solid fa-location-dot animate-bounce text-3xl text-loca-500" />
        <p className="text-xs text-gray-500">
          Loca を起動しています...{progress !== null && ` ${Math.floor(progress * 100)}%`}
        </p>
      </div>
    );
  }

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices は ServicesProvider の内側でのみ使えます');
  return ctx;
}
