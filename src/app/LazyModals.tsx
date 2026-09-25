/**
 * 開いたときに読み込む画面をまとめる（初期読み込みの JS を 260 kB 以内に保つ。T62）。
 * 閉じている間は描かないので、状態を持たない画面か、開くたびに初期化してよい画面だけを置く。
 */

import React, { Suspense, lazy } from 'react';
import type { LatLng } from '@/core/types';
import type { LocaApp } from './useLocaApp';

const MyPostsModal = lazy(() => import('@/features/profile/MyPostsModal'));
const AdminDashboard = lazy(() => import('@/features/admin/AdminDashboard'));
const VideoDetailsModal = lazy(() => import('@/features/marker/VideoDetailsModal'));
const ContributeGuideModal = lazy(() => import('@/features/contribute/ContributeGuideModal'));

interface LazyModalsProps {
  app: LocaApp;
  /** ログイン中の uid。未ログインなら自分の投稿は出さない */
  uid: string | null;
}

export default function LazyModals({ app, uid }: LazyModalsProps) {
  /** 自分の投稿・管理者モードの一覧で選んだら、画面を閉じて地図をその地点へ移し、詳細を開く（T53） */
  const pickFrom =
    (modal: 'myPosts' | 'admin') =>
    <T extends LatLng>(select: (item: T) => void) =>
    (item: T) => {
      app.openModal(modal, false);
      app.jumpTo({ lat: item.lat, lng: item.lng });
      select(item);
    };
  const pickMine = pickFrom('myPosts');
  const pickAdmin = pickFrom('admin');

  return (
    <Suspense fallback={null}>
      {uid && app.modals.myPosts && (
        <MyPostsModal
          open
          uid={uid}
          markers={app.catalog.markers}
          requestMarkers={app.catalog.requestMarkers}
          onPickMarker={pickMine((m) => app.handleMarkerClick(m))}
          onPickRequest={pickMine((r) => app.handleRequestClick(r))}
          onClose={() => app.openModal('myPosts', false)}
        />
      )}

      {app.modals.videoDetails && (
        <VideoDetailsModal open marker={app.selectedMarker} onClose={() => app.openModal('videoDetails', false)} />
      )}

      {app.modals.guide && <ContributeGuideModal open onClose={() => app.openModal('guide', false)} />}

      {app.modals.admin && (
        <AdminDashboard
          open
          markers={app.catalog.markers}
          requestMarkers={app.catalog.requestMarkers}
          onClose={() => app.openModal('admin', false)}
          onJump={pickAdmin((m) => app.handleMarkerClick(m))}
          onJumpRequest={pickAdmin((r) => app.handleRequestClick(r))}
        />
      )}
    </Suspense>
  );
}
