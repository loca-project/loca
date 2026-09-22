/**
 * マーカーが 1 件も無いときだけ地図の上に出す案内。
 *
 * 公開直後は地図が真っ白になる。初めて来た人が「壊れている」と思わないよう、
 * 何のサイトで、どうすれば載るのかをここで伝える。
 * 1 件でも登録されれば自動的に消えるので、閉じる操作は用意しない。
 */

import React from 'react';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { canContribute } from '@/runtime/config';

interface EmptyMapNoticeProps {
  /** サイドメニューの右端。地図の見える範囲に収めるために使う */
  offsetLeft: number;
  onOpenGuide: () => void;
}

export default function EmptyMapNotice({ offsetLeft, onOpenGuide }: EmptyMapNoticeProps) {
  const { t } = useI18n();

  return (
    <div
      className="pointer-events-none absolute bottom-0 top-0 z-20 flex items-center justify-center p-4 transition-[left] duration-200"
      style={{ left: offsetLeft, right: 0 }}
    >
      <div className="pointer-events-auto w-[min(26rem,100%)] rounded-xl border border-gray-200 bg-white/95 p-5 text-center shadow-xl backdrop-blur">
        <i className="fa-solid fa-location-dot mb-2 text-2xl text-loca-500" />
        <h2 className="text-sm font-bold text-gray-800">{t.appName}</h2>
        <p className="mt-1 text-[11px] text-gray-500">{t.tagline}</p>

        <p className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
          {t.empty.body}
        </p>

        {canContribute() && (
          <Button className="mt-4 w-full" onClick={onOpenGuide}>
            <i className="fa-solid fa-circle-question mr-1.5" />
            {t.empty.howTo}
          </Button>
        )}
      </div>
    </div>
  );
}
