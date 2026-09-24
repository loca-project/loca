import React from 'react';
import { ToastProvider } from './shared/components/Toast';
import { ProfileProvider } from './shared/hooks/useProfile';
import AppShell from './app/AppShell';
import ProfileGate from './features/profile/ProfileGate';

/** プロバイダだけを重ねる薄い入口。実体は AppShell にある。 */
export default function App() {
  return (
    <ToastProvider>
      <ProfileProvider>
        <AppShell />
        <ProfileGate />
      </ProfileProvider>
    </ToastProvider>
  );
}
