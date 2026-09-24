import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
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
            if (/[\\/]node_modules[\\/](@firebase|firebase)[\\/]/.test(id)) return 'vendor-firebase';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
  };
});
