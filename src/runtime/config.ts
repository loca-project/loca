/**
 * 環境変数の読み取り。
 * ここが import.meta.env に触れる唯一の場所。他のモジュールは appConfig だけを見る。
 *
 * 構成は GitHub Pages に固定されたので、アダプタの切り替えスイッチは持たない。
 * 残しているのは「公開データの置き場」と「Firebase のウェブ設定」だけ。
 */

function env(key: string): string {
  const source = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return (source[key] ?? '').trim();
}

export interface AppConfig {
  /** 静的 JSON の置き場（index.html からの相対）。 */
  dataBaseUrl: string;
  /**
   * Firebase のウェブ設定（ADR 0010）。公開してよい識別子だが、ソースには書かず .env.local から渡す。
   * 1 つでも欠けたら書き込み機能（ログイン・投稿・通報）を無効にし、閲覧だけで起動する。
   */
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
}

export const appConfig: AppConfig = {
  dataBaseUrl: env('VITE_DATA_BASE_URL') || './data',
  firebase: {
    apiKey: env('VITE_FIREBASE_API_KEY'),
    authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: env('VITE_FIREBASE_PROJECT_ID'),
    appId: env('VITE_FIREBASE_APP_ID'),
  },
};

/** Firebase（ログイン・投稿・通報）を使える構成かどうか。設定値が全部そろったときだけ true。 */
export function canUseFirebase(): boolean {
  return Object.values(appConfig.firebase).every((value) => value.length > 0);
}
