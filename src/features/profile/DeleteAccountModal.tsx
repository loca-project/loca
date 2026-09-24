/**
 * アカウント削除の最終確認（要件 2.7・ADR 0021）。
 * 何が消え、いつ完全に消去されるかを書く。押すと Google の本人確認が出る。
 */

import React from 'react';
import Modal from '@/shared/components/Modal';
import { Button } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface DeleteAccountModalProps {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteAccountModal({ busy, onConfirm, onCancel }: DeleteAccountModalProps) {
  const { t } = useI18n();
  const d = t.profile.deletion;

  return (
    <Modal
      open
      title={d.title}
      // 実行中は閉じさせない（途中で画面を離れても、もう一度押せば続きから進む）
      onClose={busy ? undefined : onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t.actions.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? d.running : d.confirm}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs font-bold text-red-700">{d.lead}</p>
      <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-gray-700">
        {d.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{d.reauthNote}</p>
    </Modal>
  );
}
