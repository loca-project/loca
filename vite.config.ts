import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react(), versionFile()],
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
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
  };
});
