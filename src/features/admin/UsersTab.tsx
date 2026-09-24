/**
 * ユーザー管理のタブ（要件 5.2.4・T59）。管理者・一般のユーザー・ブラックリストの 3 区画を横に並べる。
 * 利用者はニックネームと uid で見分ける（メールと Google の名前は保存しない。ADR 0019）。
 * 操作は「削除」（プロフィールと名前の索引。マーカーは消さない）と「ブラックリスト」の 2 つ。管理者には操作を出さない。
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { AdminUserLists, AdminUserRow } from '@/ports';
import { formatDate } from '@/core/logic/format';
import { Button } from '@/shared/components/Controls';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useI18n } from '@/shared/hooks/useI18n';
import { useServices } from '@/shared/hooks/useServices';
import { useToast } from '@/shared/components/Toast';

function UserLine({ row, children }: { row: AdminUserRow; children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <li className="border-b border-gray-50 py-2">
      <p className="truncate text-xs font-bold text-gray-800">{row.nickname ?? t.admin.users.noProfile}</p>
      <p className="truncate font-mono text-[10px] text-gray-400" title={row.uid}>
        {row.uid}
      </p>
      {row.createdAt > 0 && (
        <p className="text-[10px] text-gray-500">
          {t.profile.createdAt}: {formatDate(row.createdAt)}
        </p>
      )}
      {children && <div className="mt-1.5 flex gap-1.5">{children}</div>}
    </li>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-gray-100 p-3">
      <h3 className="mb-1 text-xs font-bold text-gray-700">
        {title}（{count}）
      </h3>
      <ul className="max-h-[50vh] overflow-y-auto">{children}</ul>
    </section>
  );
}

export default function UsersTab() {
  const { adminStore } = useServices();
  const { t } = useI18n();
  const u = t.admin.users;
  const toast = useToast();
  const { loading, exclusive } = useExclusive();
  const [lists, setLists] = useState<AdminUserLists | null>(null);

  const reload = useCallback(async () => {
    if (!adminStore) return;
    try {
      setLists(await adminStore.users());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [adminStore, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 確認してから実行し、終わったら読み直す。 */
  const act = (confirmText: string, action: () => Promise<void>, done: string) => () => {
    if (!window.confirm(confirmText)) return;
    void exclusive(async () => {
      try {
        await action();
        toast.success(done);
        await reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  if (!adminStore) return null;
  if (!lists) return <p className="text-xs text-gray-500">{t.details.loading}</p>;

  const name = (row: AdminUserRow) => row.nickname ?? row.uid;
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Button variant="secondary" onClick={() => void exclusive(reload)} disabled={loading}>
          <i className="fa-solid fa-rotate mr-1.5" />
          {u.reload}
        </Button>
        <p className="text-[11px] text-gray-500">{u.note}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Section title={u.admins} count={lists.admins.length}>
          {lists.admins.map((row) => (
            <UserLine key={row.uid} row={row} />
          ))}
        </Section>
        <Section title={u.users} count={lists.users.length}>
          {lists.users.map((row) => (
            <UserLine key={row.uid} row={row}>
              <Button
                variant="dangerSoft"
                disabled={loading}
                onClick={act(u.confirmDelete.replace('{name}', name(row)), () => adminStore.deleteUser(row.uid), u.deleted)}
              >
                {u.delete}
              </Button>
              <Button
                variant="danger"
                disabled={loading}
                onClick={act(u.confirmBlacklist.replace('{name}', name(row)), () => adminStore.blacklist(row.uid), u.blacklisted)}
              >
                {u.toBlacklist}
              </Button>
            </UserLine>
          ))}
        </Section>
        <Section title={u.blacklist} count={lists.blacklist.length}>
          {lists.blacklist.map((row) => (
            <UserLine key={row.uid} row={row}>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={act(u.confirmUnblacklist.replace('{name}', name(row)), () => adminStore.unblacklist(row.uid), u.unblacklisted)}
              >
                {u.unblacklist}
              </Button>
            </UserLine>
          ))}
        </Section>
      </div>
    </div>
  );
}
