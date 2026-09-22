import React from 'react';
import { ToastProvider } from './shared/components/Toast';
import AppShell from './app/AppShell';

/** プロバイダだけを重ねる薄い入口。実体は AppShell にある。 */
export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
