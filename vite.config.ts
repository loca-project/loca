import path from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildFeed } from './scripts/lib/feed.mjs';

/**
 * 新着マーカーの RSS を dist/feed.xml に書く（T47）。中身は公開データ public/data/markers.json から作る。
 * 公開データを読めなければビルドを止める（空の RSS を黙って出さない）。
 */
function feedFile(): Plugin {
  return {
    name: 'loca-feed-file',
    apply: 'build',
    generateBundle() {
      const file = path.resolve(__dirname, 'public', 'data', 'markers.json');
      const bundle = JSON.parse(readFileSync(file, 'utf8')) as { markers?: unknown[] } | unknown[];
      const markers = (Array.isArray(bundle) ? bundle : (bundle.markers ?? [])) as Parameters<typeof buildFeed>[0]['markers'];
      this.emitFile({ type: 'asset', fileName: 'feed.xml', source: buildFeed({ markers }).xml });
    },
  };
}

/**
 * 公開した版を dist/version.json に書く（T56・ADR 0022）。
 * 版は入口の JS のファイル名。中身のハッシュを含むので、コードが変わったときだけ変わる
 * （毎晩の同期でデータだけが変わっても、開いているタブに再読み込みを促さない）。
 */
function versionFile(): Plugin {
  return {
    name: 'loca-version-file',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find((f) => f.type === 'chunk' && f.isEntry);
      if (!entry) throw new Error('入口の JS が見つからず、version.json を作れません');
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ entry: entry.fileName })}\n`,
      });
    },
  };
}

/**
 * Loca のビルド設定。配信先は GitHub Pages。
 *
 * - base は './'。ユーザーサイト（user.github.io）でもプロジェクトサイト
 *   （user.github.io/loca/）でも、同じ成果物がそのまま動く。
 * - 出力は静的ファイルのみ。サーバー機能は一切使わない。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.VITE_BASE_PATH || './',
    server: { port: 5173, host: '127.0.0.1' },
    preview: { port: 4173, host: '127.0.0.1' },
    plugins: [react(), versionFile(), feedFile()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('maplibre-gl')) return 'vendor-maplibre';
            // Firebase は設定値があるときだけ遅延 import する。初期の vendor に混ぜない
            // （re2js・idb は Firestore と Auth だけが使う依存。混ざると初期読み込みが 150 kB 増える）
            if (/[\\/]node_modules[\\/](@firebase|firebase|re2js|idb)[\\/]/.test(id)) return 'vendor-firebase';
            // AI 検索（ADR 0033）は使ったときだけ遅延 import する。初期の vendor に混ぜると 580 kB 増える（2026-09-26 実測）
            if (/[\\/]node_modules[\\/](@huggingface|onnxruntime-web|onnxruntime-common|flatbuffers|guid-typescript|long|protobufjs)[\\/]/.test(id)) {
              return 'vendor-ai';
            }
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
  };
});
