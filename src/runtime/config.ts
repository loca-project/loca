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

export interface AppConfig {
  /** 静的 JSON の置き場（index.html からの相対）。 */
  dataBaseUrl: string;
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
