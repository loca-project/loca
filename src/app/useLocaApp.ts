/**
 * アプリの状態と操作をまとめた view-model。
 * App.tsx は、ここが返す値を描画するだけにする。
 *
 * 認証もデータベースも無いので、保持するのは UI 状態と読み込んだ公開データだけ。
 */

import { useCallback, useMemo, useState } from 'react';
import type { Bounds, LatLng, MarkerData, RankingFilter, RequestMarkerData } from '@/core/types';
import { DEFAULT_RANKING_FILTER, MapMode, TabMode } from '@/core/types';
import { JUMP_ZOOM } from '@/core/logic/geo';
import { useCatalog } from '@/shared/hooks/useCatalog';
import { useServices } from '@/shared/hooks/useServices';
import { EMPTY_FORM, type MarkerFormState } from '@/features/marker/formState';
import { EMPTY_REQUEST_FORM, type RequestFormState } from '@/features/sidebar/RequestForm';
import type { SearchTarget } from '@/features/sidebar/SearchPanel';

export type ModalName = 'stats' | 'report' | 'videoDetails' | 'requestList' | 'guide';

export function useLocaApp() {
  const services = useServices();
  const catalog = useCatalog();

  const [tab, setTab] = useState<TabMode>(TabMode.MAP);
  const [mapMode, setMapMode] = useState<MapMode>(MapMode.SEARCH);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestMarkerData | null>(null);
  const [tempPos, setTempPos] = useState<LatLng | null>(null);

  const [form, setForm] = useState<MarkerFormState>(EMPTY_FORM);
  const [requestForm, setRequestForm] = useState<RequestFormState>(EMPTY_REQUEST_FORM);
  const [registerTab, setRegisterTab] = useState<'marker' | 'request'>('marker');

  const [searchTarget, setSearchTarget] = useState<SearchTarget>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [rectangle, setRectangle] = useState<Bounds | null>(null);

  const [filter, setFilter] = useState<RankingFilter>(DEFAULT_RANKING_FILTER);
  const [modals, setModals] = useState<Record<ModalName, boolean>>({
    stats: false,
    report: false,
    videoDetails: false,
    requestList: false,
    guide: false,
  });

  const openModal = useCallback((name: ModalName, open = true) => {
    setModals((prev) => ({ ...prev, [name]: open }));
  }, []);

  /** 検索モードに戻し、仮マーカーと選択を解除する（要件 3.2）。 */
  const resetToSearch = useCallback(() => {
    setMapMode(MapMode.SEARCH);
    setTempPos(null);
    setSelectedMarker(null);
    setSelectedRequest(null);
    setForm(EMPTY_FORM);
    setRequestForm(EMPTY_REQUEST_FORM);
    services.map.closeInfoWindow();
  }, [services.map]);

  const jumpTo = useCallback(
    (pos: LatLng) => {
      services.map.setCenter(pos, JUMP_ZOOM);
      setTab(TabMode.MAP);
    },
    [services.map],
  );

  /** 地図クリックで投稿モードに入る。認証が無いので誰でも入れる。 */
  const handleMapClick = useCallback(
    (pos: LatLng) => {
      if (drawing) return;
      services.map.closeInfoWindow();
      setTab(TabMode.MAP);
      setMapMode(MapMode.REGISTER);
      setSelectedMarker(null);
      setSelectedRequest(null);
      setTempPos(pos);
      setForm({ ...EMPTY_FORM, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) });
      setSidebarOpen(true);
    },
    [drawing, services.map],
  );

  const handleMarkerClick = useCallback((marker: MarkerData) => {
    setTab(TabMode.MAP);
    setSelectedRequest(null);
    setSelectedMarker(marker);
    setTempPos(null);
    setMapMode(MapMode.EDIT);
    setSidebarOpen(true);
  }, []);

  const handleRequestClick = useCallback((marker: RequestMarkerData) => {
    setTab(TabMode.MAP);
    setSelectedMarker(null);
    setSelectedRequest(marker);
    setTempPos(null);
    setMapMode(MapMode.REQUEST_VIEW);
    setSidebarOpen(true);
  }, []);

  /** GPS 欄の手入力に合わせて仮マーカーと地図を動かす（要件 3.2）。 */
  const patchForm = useCallback(
    (patch: Partial<MarkerFormState>) => {
      setForm((prev) => {
        const next = { ...prev, ...patch };
        if (patch.lat !== undefined || patch.lng !== undefined) {
          const lat = Number(next.lat);
          const lng = Number(next.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            setTempPos({ lat, lng });
            services.map.setCenter({ lat, lng });
          }
        }
        return next;
      });
    },
    [services.map],
  );

  const requestEntriesOf = useMemo(
    () => (markerId: string) => catalog.requestMarkers.filter((r) => r.id === markerId),
    [catalog.requestMarkers],
  );

  return {
    services,
    catalog,
    tab,
    setTab,
    mapMode,
    setMapMode,
    sidebarOpen,
    setSidebarOpen,
    selectedMarker,
    setSelectedMarker,
    selectedRequest,
    tempPos,
    setTempPos,
    form,
    patchForm,
    setForm,
    requestForm,
    setRequestForm,
    registerTab,
    setRegisterTab,
    searchTarget,
    setSearchTarget,
    searchQuery,
    setSearchQuery,
    drawing,
    setDrawing,
    rectangle,
    setRectangle,
    filter,
    setFilter,
    modals,
    openModal,
    resetToSearch,
    jumpTo,
    handleMapClick,
    handleMarkerClick,
    handleRequestClick,
    requestEntriesOf,
  };
}

export type LocaApp = ReturnType<typeof useLocaApp>;
