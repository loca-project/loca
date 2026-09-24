/** 投稿の流れを説明するモーダル（右上のメニューと、登録が無いときの案内から開く）。 */

import React from 'react';
import Modal from '@/shared/components/Modal';
import { useI18n } from '@/shared/hooks/useI18n';
import { canUseFirebase } from '@/runtime/config';

export default function ContributeGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const steps = [t.contribute.guide1, t.contribute.guide2, t.contribute.guide3, t.contribute.guide4];

  return (
    <Modal open={open} title={t.contribute.guideTitle} onClose={onClose}>
      {!canUseFirebase() ? (
        <p className="rounded-md bg-amber-50 p-3 text-[11px] text-amber-800">{t.store.unavailable}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-2 text-xs text-gray-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-loca-500 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">{t.contribute.guideNote}</p>
        </>
      )}
    </Modal>
  );
}
