/** 投稿の仕組みを説明するモーダル。認証が無いぶん、手順を明示しておく。 */

import React from 'react';
import Modal from '@/shared/components/Modal';
import { useI18n } from '@/shared/hooks/useI18n';
import { issueListUrl } from '@/features/contribute/issueUrl';
import { canContribute } from '@/runtime/config';

export default function ContributeGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const listUrl = issueListUrl();

  const steps = [t.contribute.guide1, t.contribute.guide2, t.contribute.guide3, t.contribute.guide4];

  return (
    <Modal open={open} title={t.contribute.guideTitle} onClose={onClose}>
      {!canContribute() ? (
        <p className="rounded bg-amber-50 p-3 text-[11px] text-amber-800">
          {t.contribute.notConfigured}
        </p>
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

          <p className="mt-4 rounded bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
            Loca はデータベースを持ちません。地図に出ているデータは GitHub リポジトリ上の
            JSON ファイルそのものです。投稿は Issue として記録され、自動チェックを通ると
            リポジトリに反映されます。誰がいつ何を追加したかは、すべて履歴に残ります。
          </p>

          {listUrl && (
            <a
              href={listUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block rounded bg-gray-900 py-2 text-center text-xs font-bold text-white hover:bg-gray-700"
            >
              <i className="fa-brands fa-github mr-1.5" />
              {t.contribute.myIssues}
            </a>
          )}
        </>
      )}
    </Modal>
  );
}
