/**
 * マーカーが 1 件も無いときだけ地図の上に出す案内。
 *
 * 公開直後は地図が真っ白になる。初めて来た人が「壊れている」と思わないよう、
 * 何のサイトで、どうすれば載るのかをここで伝える。
 *
 * 閲覧しかしない人には邪魔になるので、閉じられるようにしてある。
 * 閉じたことはブラウザに覚えさせる（この端末のこのブラウザだけの設定）。
 * 1 件でも登録されれば、閉じたかどうかに関係なく表示されなくなる。
 */

import React, { useState } from 'react';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';
import { canContribute } from '@/runtime/config';

const STORAGE_KEY = 'loca.emptyNotice.dismissed';

/** localStorage は使えないことがある（プライベートウィンドウ等）ので必ず包む。 */
function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

interface EmptyMapNoticeProps {
  /** サイドメニューの右端。地図の見える範囲に収めるために使う */
  offsetLeft: number;
  onOpenGuide: () => void;
}

export default function EmptyMapNotice({ offsetLeft, onOpenGuide }: EmptyMapNoticeProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // 保存できなくても、この表示のあいだは閉じたままにする
    }
  };

  return (
    <div
      className="pointer-events-none absolute bottom-0 top-0 z-20 flex items-center justify-center p-4 transition-[left] duration-200"
      style={{ left: offsetLeft, right: 0 }}
    >
      <div className="pointer-events-auto relative w-[min(26rem,100%)] rounded-xl border border-gray-200 bg-white/95 p-5 text-center shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={close}
          aria-label={t.close}
          title={t.close}
          className="absolute right-2 top-2 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <i className="fa-solid fa-location-dot mb-2 text-2xl text-loca-500" />
        <h2 className="text-sm font-bold text-gray-800">{t.appName}</h2>
        <p className="mt-1 text-[11px] text-gray-500">{t.tagline}</p>

        <p className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
          {t.empty.body}
        </p>

        <div className="mt-4 flex gap-2">
          {canContribute() && (
            <Button className="flex-1" onClick={onOpenGuide}>
              <i className="fa-solid fa-circle-question mr-1.5" />
              {t.empty.howTo}
            </Button>
          )}
          <Button variant="secondary" className={canContribute() ? '' : 'flex-1'} onClick={close}>
            {t.empty.dismiss}
          </Button>
        </div>
      </div>
    </div>
  );
}
