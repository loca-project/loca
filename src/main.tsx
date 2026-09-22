import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ServicesProvider } from './shared/hooks/useServices';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root が見つかりません。index.html を確認してください。');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ServicesProvider>
      <App />
    </ServicesProvider>
  </React.StrictMode>,
);
