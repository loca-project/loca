import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ServicesProvider } from './shared/hooks/useServices';
import { prepareLanguage } from './i18n';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root が見つかりません。index.html を確認してください。');
}

// 英語の辞書は別ファイル。英語で開いたときは読み込んでから描く（日本語の一瞬の表示を避ける）
void prepareLanguage().then(() => {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ServicesProvider>
        <App />
      </ServicesProvider>
    </React.StrictMode>,
  );
});
