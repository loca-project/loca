/** サイドメニューに何を出すかの振り分け。タブと地図モードだけで決まる。 */

import React from 'react';
import { MapMode, TabMode } from '@/core/types';
import { useI18n } from '@/shared/hooks/useI18n';
import SearchPanel from '@/features/sidebar/SearchPanel';
import MarkerForm from '@/features/sidebar/MarkerForm';
import MarkerDetails from '@/features/sidebar/MarkerDetails';
import RankingFilters from '@/features/sidebar/RankingFilters';
import RequestForm from '@/features/sidebar/RequestForm';
import RequestView from '@/features/sidebar/RequestView';
import type { LocaApp } from './useLocaApp';

export interface SidebarHandlers {
  onSearch: () => void;
  onStartDrawing: () => void;
  onClearRectangle: () => void;
  onSubmitMarker: () => void;
  onSubmitRequest: () => void;
  onApplyRanking: () => void;
  onShare: () => void;
  onReport: () => void;
  onWatch: () => void;
  onAddRequest: () => void;
  onPostVideoFromRequest: () => void;
  onSearchRelated: () => void;
  onEditMarker: () => void;
  onDeleteMarker: () => void;
}

interface SidebarContentProps {
  app: LocaApp;
  handlers: SidebarHandlers;
  busy: boolean;
  /** Firestore に保存する構成か */
  usesStore: boolean;
  /** ログイン中のユーザーの uid。未ログインなら null */
  currentUid: string | null;
}

export function sidebarTitle(app: LocaApp, t: ReturnType<typeof useI18n>['t']): string {
  if (app.tab === TabMode.RANKING_REGION) return t.headers.regionRanking;
  if (app.tab === TabMode.RANKING_CHANNEL) return t.headers.channelRanking;
  if (app.tab === TabMode.RANKING_EQUIPMENT) return t.headers.gearRanking;
  if (app.tab === TabMode.RANKING_REQUEST) return t.headers.requestRanking;
  if (app.mapMode === MapMode.REGISTER) return t.headers.newReg;
  if (app.mapMode === MapMode.REQUEST_VIEW) return t.headers.requestTitle;
  if (app.mapMode === MapMode.EDIT) return t.headers.viewMarker;
  return t.headers.mapSearch;
}

export default function SidebarContent({ app, handlers, busy, usesStore, currentUid }: SidebarContentProps) {
  const { t } = useI18n();

  if (app.tab !== TabMode.MAP) {
    return (
      <RankingFilters
        tab={app.tab}
        filter={app.filter}
        equipment={app.catalog.equipment}
        loading={busy}
        onChange={(patch) => app.setFilter((prev) => ({ ...prev, ...patch }))}
        onApply={handlers.onApplyRanking}
      />
    );
  }

  if (app.mapMode === MapMode.REQUEST_VIEW && app.selectedRequest) {
    return (
      <RequestView
        marker={app.selectedRequest}
        onAddRequest={handlers.onAddRequest}
        onPostVideo={handlers.onPostVideoFromRequest}
        onSearchRelated={handlers.onSearchRelated}
        onCancel={app.resetToSearch}
      />
    );
  }

  if (app.mapMode === MapMode.REGISTER) {
    return (
      <div className="flex flex-col gap-3">
        {!app.editing && (
          <div className="grid grid-cols-2 overflow-hidden rounded border border-gray-300 text-[11px]">
            {(['marker', 'request'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => app.setRegisterTab(value)}
                className={`py-1.5 font-bold transition ${
                  app.registerTab === value ? 'bg-loca-500 text-white' : 'bg-white text-gray-600'
                }`}
              >
                {value === 'marker' ? t.form.tabRegister : t.form.tabRequest}
              </button>
            ))}
          </div>
        )}

        {app.registerTab === 'marker' ? (
          <MarkerForm
            form={app.form}
            equipment={app.catalog.equipment}
            loading={busy}
            onChange={app.patchForm}
            onSubmit={handlers.onSubmitMarker}
            onCancel={app.resetToSearch}
            usesStore={usesStore}
            editing={app.editing !== null}
          />
        ) : (
          <RequestForm
            form={app.requestForm}
            equipment={app.catalog.equipment}
            loading={busy}
            onChange={(patch) => app.setRequestForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={handlers.onSubmitRequest}
            onCancel={app.resetToSearch}
          />
        )}
      </div>
    );
  }

  if (app.mapMode === MapMode.EDIT && app.selectedMarker) {
    // 本人判定は表示の切り替えだけ。GitHub 経由の投稿は ownerUid が無いので誰にも出ない
    const isOwner = usesStore && currentUid !== null && app.selectedMarker.ownerUid === currentUid;
    return (
      <MarkerDetails
        marker={app.selectedMarker}
        onCancel={app.resetToSearch}
        onShare={handlers.onShare}
        onReport={handlers.onReport}
        onWatch={handlers.onWatch}
        onEdit={isOwner ? handlers.onEditMarker : undefined}
        onDelete={isOwner ? handlers.onDeleteMarker : undefined}
        busy={busy}
      />
    );
  }

  return (
    <SearchPanel
      target={app.searchTarget}
      query={app.searchQuery}
      loading={busy}
      drawing={app.drawing}
      hasRectangle={app.rectangle !== null}
      onTargetChange={app.setSearchTarget}
      onQueryChange={app.setSearchQuery}
      onSearch={handlers.onSearch}
      onStartDrawing={handlers.onStartDrawing}
      onClearRectangle={handlers.onClearRectangle}
    />
  );
}
