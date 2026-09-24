/**
 * プロフィール登録画面（要件 1.1・2.5・ADR 0019）。初回のログインで画面中央に出す。
 * 同意はすべて未選択から始め、全部に印が付き、ニックネームが正しいときだけ「登録」を押せる（要件 2.5.3）。
 * 「キャンセル」はログアウトする（未登録のままでは投稿できないため）。
 */

import React, { useState } from 'react';
import { CONSENT_KEYS, NICKNAME_MAX, isValidNickname, normalizeNickname, type ConsentKey } from '@/core/logic/profile';
import Modal from '@/shared/components/Modal';
import { Button, Checkbox, Field, TextInput } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface RegisterModalProps {
  busy: boolean;
  onRegister: (nickname: string) => void;
  onCancel: () => void;
}

export default function RegisterModal({ busy, onRegister, onCancel }: RegisterModalProps) {
  const { t } = useI18n();
  const [nickname, setNickname] = useState('');
  const [agreed, setAgreed] = useState<Record<ConsentKey, boolean>>({ rights: false, onSite: false, data: false });

  const normalized = normalizeNickname(nickname);
  const canRegister = !busy && isValidNickname(normalized) && CONSENT_KEYS.every((k) => agreed[k]);

  return (
    <Modal
      open
      title={t.profile.registerTitle}
      // onClose を渡さない: 背景や Esc では閉じず、キャンセル（ログアウト）か登録を選ばせる
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t.profile.cancelRegister}
          </Button>
          <Button onClick={() => onRegister(normalized)} disabled={!canRegister}>
            {busy ? t.form.processing : t.profile.register}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-xs leading-relaxed text-gray-600">{t.profile.registerLead}</p>

      <Field label={t.profile.nickname} hint={t.profile.nicknameHint}>
        <TextInput
          value={nickname}
          maxLength={NICKNAME_MAX}
          autoFocus
          aria-label={t.profile.nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </Field>

      <p className="mb-2 mt-4 text-[11px] font-bold text-gray-500">{t.profile.consentsTitle}</p>
      <div className="flex flex-col gap-2.5">
        {CONSENT_KEYS.map((key) => (
          <Checkbox key={key} checked={agreed[key]} onChange={(v) => setAgreed((prev) => ({ ...prev, [key]: v }))}>
            {t.profile.consents[key]}
          </Checkbox>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t.profile.privacyNote}</p>
    </Modal>
  );
}
