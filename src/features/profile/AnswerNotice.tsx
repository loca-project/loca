/**
 * 撮影リクエストに動画が届いたことを、ログイン中の依頼者に画面上部の帯で知らせる（T43・ADR 0028）。
 * Cloud Functions が使えないので、地図の一覧（公開データ＋差分の購読）から自分宛てを探して出す。読み取りは増えない。
 * 「閉じる」はこのタブを開いている間だけ効く（受け取るまでは次に開いたときにまた出す）。
 */

import React, { useMemo, useState } from 'react';
import type { MarkerData, RequestMarkerData } from '@/core/types';
import { deliveredAnswers } from '@/core/logic/answers';
import { interpolate } from '@/core/logic/format';
import { useI18n } from '@/shared/hooks/useI18n';

interface AnswerNoticeProps {
  uid: string | null;
  markers: MarkerData[];
  spots: RequestMarkerData[];
  /** 「見る」（自分の投稿の撮影リクエストのタブを開く） */
  onOpen: () => void;
}

export default function AnswerNotice({ uid, markers, spots, onOpen }: AnswerNoticeProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  const count = useMemo(() => (uid ? deliveredAnswers(markers, spots, uid).length : 0), [uid, markers, spots]);
  if (!uid || count === 0 || dismissed) return null;

  return (
    <div role="status" className="absolute left-1/2 top-28 z-30 sm:top-16 w-[min(28rem,calc(100%-8rem))] -translate-x-1/2">
      <p className="flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-[11px] text-orange-800 shadow-md">
        <i className="fa-solid fa-fire" />
        <span className="flex-1">{interpolate(t.answers.notice, { count })}</span>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onOpen();
          }}
          className="shrink-0 rounded bg-orange-600 px-2 py-1 font-bold text-white hover:bg-orange-700"
        >
          {t.answers.open}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="shrink-0 px-1 text-orange-700" aria-label={t.answers.dismiss}>
          <i className="fa-solid fa-xmark" />
        </button>
      </p>
    </div>
  );
}
