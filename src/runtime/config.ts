/**
 * 環境変数の読み取り。
 * ここが import.meta.env に触れる唯一の場所。他のモジュールは appConfig だけを見る。
 *
 * 構成は GitHub Pages に固定されたので、アダプタの切り替えスイッチは持たない。
 * 残しているのは「配信先の URL」と「投稿先の GitHub リポジトリ」だけ。
 */

function env(key: string): string {
  const source = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return (source[key] ?? '').trim();
}

function list(key: string, separator = ';'): string[] {
  return env(key)
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** OpenFreeMap の既定スタイル。API キー不要・リクエスト数無制限・商用可。 */
const DEFAULT_MAP_STYLES = ['https://tiles.openfreemap.org/styles/positron'];

export interface AppConfig {
  /** 静的 JSON の置き場（index.html からの相対）。 */
  dataBaseUrl: string;
  map: {
    /** MapLibre のスタイル URL。複数指定すると先頭から順にフォールバックする */
    styleUrls: string[];
  };
  github: {
    /** owner/repo。未設定なら投稿導線を出さない */
    repo: string;
    /** Issue フォームのファイル名 */
    markerTemplate: string;
    requestTemplate: string;
    reportTemplate: string;
  };
}

export const appConfig: AppConfig = {
  dataBaseUrl: env('VITE_DATA_BASE_URL') || './data',
  map: {
    styleUrls: list('VITE_MAP_STYLE_URLS').length > 0 ? list('VITE_MAP_STYLE_URLS') : DEFAULT_MAP_STYLES,
  },
  github: {
    repo: env('VITE_GITHUB_REPO'),
    markerTemplate: env('VITE_ISSUE_TEMPLATE_MARKER') || 'marker.yml',
    requestTemplate: env('VITE_ISSUE_TEMPLATE_REQUEST') || 'request.yml',
    reportTemplate: env('VITE_ISSUE_TEMPLATE_REPORT') || 'report.yml',
  },
};

/** 投稿導線（GitHub Issue）を出せる構成かどうか。 */
export function canContribute(): boolean {
  return appConfig.github.repo.length > 0;
}
