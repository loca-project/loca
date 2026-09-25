/**
 * プロフィール画面（要件 2.6・ADR 0019）。変えられるのはニックネームだけで、これまでのマーカーの投稿者名も追従する。
 * 登録日・同意した日時と、連携中の Google アカウント（ログインの仕組みが持つ値。Loca には保存しない）を見せる。
 * 左下の「アカウントを削除」から、削除の確認（DeleteAccountModal）に進む。
 */

import React, { useState } from 'react';
import type { UserProfile } from '@/core/types';
import { NICKNAME_MAX, isValidNickname, normalizeNickname } from '@/core/logic/profile';
import { formatDate, formatDateTime } from '@/core/logic/format';
import { channelUrl, parseChannelInput } from '@/core/logic/channel';
import type { AuthUser } from '@/ports';
import Modal from '@/shared/components/Modal';
import { Button, Field, TextInput } from '@/shared/components/Controls';
import { useI18n } from '@/shared/hooks/useI18n';

interface ProfileModalProps {
  profile: UserProfile;
  user: AuthUser;
  busy: boolean;
  onSave: (nickname: string) => void;
  /** 自己申告のチャンネルを保存する（空文字で消す。T55） */
  onSaveChannel: (channel: string) => void;
  onClose: () => void;
  /** アカウント削除の確認を開く（ADR 0021） */
  onDelete: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-50 py-2 text-xs">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 truncate text-right text-gray-800">{children}</span>
    </div>
  );
}

export default function ProfileModal({ profile, user, busy, onSave, onSaveChannel, onClose, onDelete }: ProfileModalProps) {
  const { t } = useI18n();
  const [nickname, setNickname] = useState(profile.nickname);
  const normalized = normalizeNickname(nickname);
  const canSave = !busy && isValidNickname(normalized) && normalized !== profile.nickname;
  const [channelText, setChannelText] = useState(profile.channel ? channelUrl(profile.channel) : '');
  const parsedChannel = parseChannelInput(channelText);
  const channelBad = channelText.trim() !== '' && parsedChannel === null;
  const channelChanged = (parsedChannel ?? '') !== (profile.channel ?? '');

  return (
    <Modal
      open
      title={t.profile.editTitle}
      onClose={onClose}
      footer={
        <>
          <Button variant="dangerSoft" className="mr-auto" onClick={onDelete} disabled={busy}>
            <i className="fa-solid fa-user-xmark mr-1.5" />
            {t.profile.deleteAccount}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t.actions.cancel}
          </Button>
          <Button onClick={() => onSave(normalized)} disabled={!canSave}>
            {busy ? t.form.processing : t.profile.update}
          </Button>
        </>
      }
    >
      <p className="mb-1 text-[11px] font-bold text-gray-500">{t.profile.google}</p>
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <i className="fa-brands fa-google text-lg text-gray-400" />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-gray-800">{user.displayName}</p>
          {user.email && <p className="truncate text-[11px] text-gray-500">{user.email}</p>}
        </div>
      </div>

      <Field label={t.profile.nickname} hint={t.profile.nicknameNote}>
        <TextInput
          value={nickname}
          maxLength={NICKNAME_MAX}
          aria-label={t.profile.nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </Field>

      <div className="mt-4">
        <Field label={t.profile.channel} hint={channelBad ? t.profile.channelInvalid : t.profile.channelNote}>
          <div className="flex gap-2">
            <TextInput
              value={channelText}
              placeholder="https://www.youtube.com/@..."
              aria-label={t.profile.channel}
              onChange={(e) => setChannelText(e.target.value)}
            />
            <Button variant="secondary" onClick={() => onSaveChannel(parsedChannel ?? '')} disabled={busy || channelBad || !channelChanged}>
              {t.profile.channelSave}
            </Button>
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <Row label={t.profile.createdAt}>{formatDate(profile.createdAt)}</Row>
        <Row label={t.profile.agreedAt}>{formatDateTime(profile.agreedAt)}</Row>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t.profile.privacyNote}</p>
    </Modal>
  );
}
