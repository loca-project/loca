/** 画面全体の組み立てと、各操作のつなぎ込み。 */

import React, { useCallback, useEffect } from 'react';
import type { LatLng, ReportReason } from '@/core/types';
import { MapMode, TabMode } from '@/core/types';
import { REPORT_REASONS } from '@/core/constants';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/components/Toast';
import MapCanvas from '@/features/map/MapCanvas';
import {
  LOCA_INFO_EVENT,
  buildMarkerInfoHtml,
  installInfoWindowDelegate,
  type InfoActionDetail,
} from '@/features/map/infoWindow';
import TabRail from '@/features/sidebar/TabRail';
import SidebarPanel, { SIDEBAR_PANEL_WIDTH, SIDEBAR_RAIL_WIDTH } from '@/features/sidebar/SidebarPanel';
import ResultsPanel from '@/features/results/ResultsPanel';
import ReportModal from '@/features/report/ReportModal';
import VideoDetailsModal from '@/features/marker/VideoDetailsModal';
import ContributeGuideModal from '@/features/contribute/ContributeGuideModal';
import EmptyMapNotice from '@/features/contribute/EmptyMapNotice';
import AdminDashboard from '@/features/admin/AdminDashboard';
import { openIssueForm } from '@/features/contribute/issueUrl';
import HeaderBar from './HeaderBar';
import SidebarContent, { sidebarTitle } from './SidebarContent';
import { useLocaApp } from './useLocaApp';
import { usePins } from './usePins';
import { useMarkerSubmit } from './useMarkerSubmit';
import { useSearchAndRanking } from './useSearchAndRanking';

export default function AppShell() {
  const { t } = useI18n();
  const toast = useToast();
  const app = useLocaApp();
  const auth = useAuth();
  const { submit, remove, loading: submitting, usesStore } = useMarkerSubmit();
  const search = useSearchAndRanking();

  const pins = usePins(
    app.catalog.markers,
    app.catalog.requestMarkers,
    app.handleMarkerClick,
    app.handleRequestClick,
  );
  const busy = submitting || search.loading || app.catalog.loading;

  // インフォウィンドウ内のボタンは CustomEvent 経由で受け取る
  useEffect(() => installInfoWindowDelegate(), []);
  useEffect(() => {
    const onAction = (e: Event) => {
      const { action, markerId } = (e as CustomEvent<InfoActionDetail>).detail;
      const marker = app.catalog.markers.find((m) => m.id === markerId);
      if (!marker) return;
      app.setSelectedMarker(marker);
      app.openModal(action === 'details' ? 'videoDetails' : 'report');
    };
    window.addEventListener(LOCA_INFO_EVENT, onAction);
    return () => window.removeEventListener(LOCA_INFO_EVENT, onAction);
  }, [app]);

  // マーカーを選んだらインフォウィンドウを開く（要件 3.5 の排他表示）
  useEffect(() => {
    if (app.mapMode === MapMode.EDIT && app.selectedMarker) {
      app.services.map.openInfoWindow({
        position: { lat: app.selectedMarker.lat, lng: app.selectedMarker.lng },
        html: buildMarkerInfoHtml(app.selectedMarker, {
          openYoutube: t.details.openYoutube,
          report: t.actions.report,
          details: t.details.btnLabel,
        }),
      });
    }
  }, [app.selectedMarker, app.mapMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth < 768) app.setSidebarOpen(false);
  }, [app]);

  const handleSearch = useCallback(async () => {
    closeMobileSidebar();
    if (app.searchTarget === 'map') {
      const error = await search.searchPlace(app.searchQuery);
      if (error) toast.error(error);
      return;
    }
    search.searchMarkers(app.searchQuery, app.catalog.markers);
  }, [app, search, toast, closeMobileSidebar]);

  const handleSubmitMarker = useCallback(async () => {
    const result = await submit({
      form: app.form,
      existing: app.catalog.markers,
      equipment: app.catalog.equipment,
      editing: app.editing,
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    if (result.saved) app.catalog.upsertMarker(result.saved);
    app.resetToSearch();
  }, [app, submit, toast]);

  /** 本人のマーカーの論理削除（要件 3.x）。元に戻せないので確認を挟む。 */
  const handleDeleteMarker = useCallback(async () => {
    const marker = app.selectedMarker;
    if (!marker || !window.confirm(t.store.confirmDelete)) return;
    const result = await remove(marker);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    app.catalog.removeMarker(marker.id);
    app.resetToSearch();
  }, [app, remove, toast, t]);

  /** ログインが要る構成で未ログインなら、登録モードに入れない（要件 1.1）。 */
  const handleMapClick = useCallback(
    (pos: LatLng) => {
      if (auth.enabled && !auth.user) {
        toast.info(t.store.loginRequired);
        return;
      }
      app.handleMapClick(pos);
    },
    [app, auth.enabled, auth.user, toast, t],
  );

  const handleSubmitRequest = useCallback(() => {
    if (!app.tempPos) return;
    const f = app.requestForm;
    const opened = openIssueForm(
      'request',
      {
        lat: app.tempPos.lat.toFixed(6),
        lng: app.tempPos.lng.toFixed(6),
        heat: String(f.heat),
        season: f.season,
        'time-of-day': f.timeOfDay,
        atmosphere: f.atmosphere,
        manufacturer: f.manufacturer,
        series: f.series,
        model: f.model,
      },
      `${app.tempPos.lat.toFixed(4)}, ${app.tempPos.lng.toFixed(4)} 熱量${f.heat}`,
    );
    if (!opened) {
      toast.error(t.contribute.notConfigured);
      return;
    }
    toast.success(t.contribute.openedTitle);
    app.resetToSearch();
  }, [app, toast, t]);

  const handleShare = useCallback(async () => {
    if (!app.selectedMarker) return;
    await navigator.clipboard.writeText(app.selectedMarker.youtubeUrl);
    toast.info(t.actions.linkCopied);
  }, [app.selectedMarker, t, toast]);

  const handleReportSubmit = useCallback(
    (reasons: ReportReason[], detail: string) => {
      if (!app.selectedMarker) return;
      const labels = reasons
        .map((id) => REPORT_REASONS.find((r) => r.id === id)?.labelKey ?? id)
        .map((key) => t.reportReasons[key as keyof typeof t.reportReasons] ?? key);

      const opened = openIssueForm(
        'report',
        {
          'marker-id': app.selectedMarker.id,
          'video-url': app.selectedMarker.youtubeUrl,
          reasons: labels.join('\n'),
          detail,
        },
        app.selectedMarker.title ?? app.selectedMarker.id,
      );
      if (!opened) {
        toast.error(t.contribute.notConfigured);
        return;
      }
      toast.success(t.contribute.openedTitle);
      app.openModal('report', false);
    },
    [app, t, toast],
  );

  const jump = useCallback((pos: LatLng) => app.jumpTo(pos), [app]);
  const sidebarOffset = SIDEBAR_RAIL_WIDTH + (app.sidebarOpen ? SIDEBAR_PANEL_WIDTH : 0);

  return (
    <div className="relative flex h-[100dvh] w-screen overflow-hidden bg-gray-100">
      <MapCanvas
        pins={pins}
        ghost={app.tempPos}
        rectangle={app.rectangle}
        drawing={app.drawing}
        onMapClick={handleMapClick}
        onRectangleDrawn={(bounds) => {
          app.setDrawing(false);
          app.setRectangle(bounds);
          search.searchInBounds(bounds, app.catalog.markers);
          closeMobileSidebar();
        }}
      />

      <TabRail
        current={app.tab}
        expanded={app.sidebarOpen}
        onSelect={(next) => {
          if (next === app.tab) {
            app.setSidebarOpen(!app.sidebarOpen);
            return;
          }
          app.setTab(next);
          app.setSidebarOpen(true);
          if (next === TabMode.MAP) app.resetToSearch();
        }}
        onToggle={() => app.setSidebarOpen(!app.sidebarOpen)}
      />

      <SidebarPanel open={app.sidebarOpen} title={sidebarTitle(app, t)}>
        <SidebarContent
          app={app}
          busy={busy}
          usesStore={usesStore}
          currentUid={auth.user?.uid ?? null}
          handlers={{
            onSearch: handleSearch,
            onStartDrawing: () => app.setDrawing(true),
            onClearRectangle: () => {
              app.setDrawing(false);
              app.setRectangle(null);
              search.close();
            },
            onSubmitMarker: handleSubmitMarker,
            onSubmitRequest: handleSubmitRequest,
            onApplyRanking: () => {
              closeMobileSidebar();
              search.applyRanking(app.tab, app.filter, app.catalog.markers, app.catalog.requestMarkers);
            },
            onShare: handleShare,
            onReport: () => app.openModal('report'),
            onWatch: () => app.openModal('videoDetails'),
            onEditMarker: () => {
              if (app.selectedMarker) app.startEdit(app.selectedMarker);
            },
            onDeleteMarker: handleDeleteMarker,
            onAddRequest: () => {
              if (!app.selectedRequest) return;
              app.setTempPos({ lat: app.selectedRequest.lat, lng: app.selectedRequest.lng });
              app.setMapMode(MapMode.REGISTER);
              app.setRegisterTab('request');
            },
            onPostVideoFromRequest: () => {
              if (!app.selectedRequest) return;
              handleMapClick({ lat: app.selectedRequest.lat, lng: app.selectedRequest.lng });
              app.setRegisterTab('marker');
            },
            onSearchRelated: () => {
              const spot = app.selectedRequest;
              if (!spot) return;
              const keyword = [spot.prefecture, spot.city].filter(Boolean).join(' ');
              app.setSearchTarget('marker');
              app.setSearchQuery(keyword);
              search.searchMarkers(keyword, app.catalog.markers);
            },
          }}
        />
      </SidebarPanel>

      {/* 公開直後など、まだ 1 件も無いときだけ出す案内 */}
      {!app.catalog.loading && app.catalog.markers.length === 0 && !search.results.open && (
        <EmptyMapNotice offsetLeft={sidebarOffset} onOpenGuide={() => app.openModal('guide')} />
      )}

      <ResultsPanel
        open={search.results.open}
        title={search.results.title}
        rows={search.results.rows}
        offsetLeft={sidebarOffset}
        limitedTo={search.results.limitedTo}
        onClose={search.close}
        onJump={jump}
      />

      <HeaderBar
        onOpenStats={() => app.openModal('stats')}
        onOpenGuide={() => app.openModal('guide')}
      />

      <ReportModal
        open={app.modals.report}
        submitting={false}
        onClose={() => app.openModal('report', false)}
        onSubmit={handleReportSubmit}
      />

      <VideoDetailsModal
        open={app.modals.videoDetails}
        marker={app.selectedMarker}
        onClose={() => app.openModal('videoDetails', false)}
      />

      <ContributeGuideModal open={app.modals.guide} onClose={() => app.openModal('guide', false)} />

      <AdminDashboard
        open={app.modals.stats}
        markers={app.catalog.markers}
        onClose={() => app.openModal('stats', false)}
      />
    </div>
  );
}
