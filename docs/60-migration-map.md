# 移植対応表（Chronos MAP → Loca）

移植元: `C:\Users\Naoki\Desktop\GitHub\Chronos-MAP`（46 ファイル / 約 9,000 行）

## 移植の原則

1. **機能は落とさない**。管理者モード・撮影リクエスト・Edge AI 検索まで全部移す。
2. **外部サービスへの直接依存を切る**。すべてポート越しにする。
3. **1 ファイル 400 行以内**（CP-2）。移植元の `App.tsx`（1,544 行）と
   `services/firebase.ts`（1,535 行）は分割必須だった。

## ファイル対応

| 移植元 | 行数 | 移植先 | 備考 |
|---|---|---|---|
| `App.tsx` | 1544 | `src/App.tsx`, `src/app/AppShell.tsx`, `useLocaApp.ts`, `SidebarContent.tsx`, `usePins.ts`, `useMarkerSubmit.ts`, `useSearchAndRanking.ts`, `UserMenu.tsx` | 状態・描画・操作を分離 |
| `services/firebase.ts` | 1535 | `src/adapters/firebase/*`（9 ファイル）＋ `src/adapters/local/*`（10 ファイル） | 1 実装 → 2 実装に増やしたうえで分割 |
| `services/externalApis.ts` | 144 | `src/adapters/video/*`（3）、`src/adapters/geocode/*`（4） | YouTube と地図を別ポートに分離 |
| `services/edgeAi.ts` | 290 | `src/adapters/semantic/*`（4） | tfjs を任意化し keyword 実装を既定に |
| `types.ts` | 200 | `src/core/types/*`（7） | 関心ごとに分割 |
| `constants.ts` | 301 | `src/core/constants/*`（6）＋ `src/i18n/*`（3） | **API キーの直書きは持ち込まない** |
| `components/ResultsView.tsx` | 499 | `src/features/results/ResultsPanel.tsx`, `resultRow.ts` | 行の形を 1 種類に正規化 |
| `components/Sidebar/MarkerForm.tsx` | 364 | `src/features/sidebar/MarkerForm.tsx`, `src/features/marker/formState.ts` | |
| `components/Sidebar/SearchPanel.tsx` | 124 | `src/features/sidebar/SearchPanel.tsx` | |
| `components/Sidebar/RankingFilters.tsx` | 299 | `src/features/sidebar/RankingFilters.tsx` | |
| `components/Sidebar/RequestView.tsx` | 204 | `src/features/sidebar/RequestView.tsx`, `RequestForm.tsx` | 閲覧と登録を分離 |
| `components/ProfileModal.tsx` | 271 | `src/features/profile/ProfileModal.tsx`, `RegisterModal.tsx`, `ProfileGate.tsx` | 登録と編集を分離。国籍・生年月日・性別は持たない（ADR 0019） |
| `components/ReportModal.tsx` | 58 | `src/features/report/ReportModal.tsx` | 要件 3.8 の複数選択に修正 |
| `components/MyMarkersModal.tsx` | 315 | `src/features/profile/MyPostsModal.tsx`, `src/core/logic/myPosts.ts` | 撮影リクエストも一覧する。地図の一覧から本人の uid で絞る（T53） |
| `components/VideoDetailsModal.tsx` | 132 | `src/features/marker/VideoDetailsModal.tsx` | |
| `components/RequestDetailsModal.tsx` | 224 | `src/features/request/RequestDetailsModal.tsx` | |
| `components/AdminMode/*.tsx` | 12 ファイル | `src/features/admin/*.tsx`（10 ファイル） | タブ構成を整理（下記） |
| `equipment_data.json` | 28 | `public/data/equipment.json` | 4 段に作り直した。3 時間ごとの機器の同期がコードの既定と管理者の編集から作る（ADR 0018・0025） |
| `docs/REQUIREMENTS.md` | 467 | `project/docs/10〜50-requirements-*.md` | 章ごとに分割＋差分注記 |
| `firebase.json` | 16 | `deploy/firebase/firebase.json` | 配信先ごとの設定を `deploy/` に隔離 |
| `.github/workflows/firebase-hosting-*.yml` | 2 ファイル | `deploy/github-pages/deploy.yml` | 配信先未定のため Pages 版を用意 |
| `src/counter.js`, `src/main.js`, `src/style.css`, `src/javascript.svg` | — | **移植せず** | Vite テンプレートの残骸で未使用 |
| `dist/`, `.firebase/` | — | **移植せず** | ビルド成果物 |
| `.env.local`（キー入り） | 1 | `.env.example`（プレースホルダのみ） | 下記「持ち込まなかったもの」参照 |

### 管理者モードのタブ対応

| 移植元 | 移植先 |
|---|---|
| `Dashboard.tsx` | `AdminDashboard.tsx` |
| `Statistics.tsx` | `StatisticsTab.tsx` ＋ `BarList.tsx` |
| `Logs.tsx` | `LogsTab.tsx` |
| `UserManagement.tsx` | `UsersTab.tsx` |
| `MarkerManagement.tsx` | `MarkersTab.tsx` |
| `EquipmentManagement.tsx` | `EquipmentTab.tsx`（分類の中を字下げの文章で直す。3 時間ごとの機器の同期で `equipment.json` に反映。ADR 0025） |
| `NetworkRestrictions.tsx` | 作らない |
| `UrlManagement.tsx` | 作らない |
| `Parameters.tsx` | 未移植 |
| `AiManagement.tsx`, `AIProcess.tsx` | 未移植（Edge AI 検索は T30） |
| `RecurringTask.tsx` | `scripts/refresh-youtube.mjs`・`sync-firestore.mjs`・`purge-deleted.mjs`（Actions）と `JobsTab.tsx` に移管 |
| （新規） | `ReportsTab.tsx`、`RequestsTab.tsx`（撮影リクエストの管理。2026-09-25）。`ExportTab.tsx` は 2026-09-25 に廃止し、書き出しは投稿動画・撮影リクエストのタブへ |

## 持ち込まなかったもの

### API キー（重要）

移植元 `constants.ts` に、Google API キー・Firebase 設定・reCAPTCHA サイトキーが
**ソース本体に直書き**されていた。Loca には一切持ち込まず、`.env.example` の
プレースホルダに置き換えた。`npm run verify` が再発を検出する。

**移植元のキーはローテーション（無効化・再発行）を推奨する。**

### 管理者メールアドレスの直書き

`ADMIN_EMAIL` 定数を `VITE_ADMIN_EMAILS`（カンマ区切り）に移した。
その後（2026-09-24）、管理者は Firestore の `admins/{uid}` で判定する形に変わり、`VITE_ADMIN_EMAILS` は使っていない（ADR 0019・T27）。

### CDN 依存

移植元は Tailwind・Font Awesome・Inter・各種 JS を CDN から読んでいた。
ローカルとオフラインで確実に動かすため、すべて npm 依存に置き換えてビルドに含めた。
サイト名の書体 Fraunces は Loca で足したもので、npm ではなく `src/assets/fonts/` に 4 文字だけ置き、CSS に埋め込む（ADR 0026）。

### 物理削除の既定

移植元の `deleteMarker` は要件 1.4 に反して物理削除していた。Loca では
`softDelete` を既定とし、物理削除は管理者向け関数として分離した。

## 未移植として残したもの

| 項目 | 理由 | どうするか |
|---|---|---|
| AI 品質管理 UI（`AiManagement`, `AIProcess`） | Gemini API 前提で、配信先とキー運用が未定 | 未移植（Edge AI 検索は T30） |
| パラメータ管理 UI（`Parameters`） | 何を設定項目にするかが未確定 | 未移植 |
| IP 単位の遮断 | 静的配信ではクライアントが IP を判定できない | 管理画面に台帳のみ。遮断は配信先の WAF |
| サーバー側 API プロキシ | サーバーを前提にできない | 配信先決定後に追加 |

---

## 2026-09-22 の構成確定にともなう削除

プラットフォームを GitHub Pages に確定し、Google API / Firebase / データベース /
認証を使わないと決めたため、次を削除した。

| 削除したもの | 理由 |
|---|---|
| `src/adapters/firebase/**`（9 ファイル） | Firebase 廃止 |
| `src/adapters/local/**`（10 ファイル） | データベースを持たない設計に変更。公開データは静的 JSON |
| `src/adapters/map/google.ts` | Google Maps 廃止 |
| `src/adapters/geocode/google.ts` | Google API 廃止 |
| `src/adapters/video/youtubeApi.ts` | YouTube Data API（Google API）廃止 |
| `src/adapters/video/fixture.ts` | 動作確認は GitHub Pages 上で行うため不要 |
| `src/adapters/semantic/**`（4 ファイル） | TensorFlow 廃止。語一致検索は `core/logic/search.ts` に統合 |
| `src/ports/auth.ts`, `src/shared/hooks/useSession.ts` | 認証を持たない |
| `src/features/profile/**` | 同上 |
| `src/features/marker/MyMarkersModal.tsx` | 「自分の」を識別する手段が無い |
| `src/app/UserMenu.tsx` | `HeaderBar.tsx` に置き換え |
| 管理者モードの 6 タブ（ユーザー/マーカー/通報/機器/制限/バックアップ） | いずれも DB か認証が前提 |
| `src/ports/data.ts` | 読み取り専用の `CatalogPort` に置き換え |
| `deploy/`（6 プラットフォーム分） | 配信先が GitHub Pages に確定 |
| `scripts/build-markers-json.mjs` | Firestore 前提。Issue 取り込みに置き換え |
| `MarkerData` の `viewCount` / `publishedAt` / `duration` / `ytLikeCount` / `commentCount` / `likeCount` | 取得手段が無い。残すと「いつか埋まる」という誤解を生む |
| 依存: firebase, @googlemaps/js-api-loader, @tensorflow/*, @google/genai | 上記に伴い削除（137 パッケージ減） |

### 追加したもの

| 追加 | 役割 |
|---|---|
| `src/ports/catalog.ts` | 公開データの読み取りポート |
| `src/adapters/staticData.ts` | 静的 JSON の唯一の実装 |
| `src/features/contribute/issueUrl.ts` | GitHub Issue フォームの URL 組み立て |
| `src/features/contribute/ContributeGuideModal.tsx` | 投稿の仕組みの説明 |
| `src/app/HeaderBar.tsx` | 言語・鮮度・統計・リポジトリ |
| `.github/ISSUE_TEMPLATE/*.yml` | 投稿フォーム 3 種 |
| `.github/workflows/deploy.yml` | push → ビルド → Pages |
| `.github/workflows/ingest-issue.yml` | Issue → JSON 追記 → push |
| `scripts/ingest-issue.mjs` ほか | 取り込みの検証と書き込み |
| `scripts/deploy.mjs` | 1 コマンド公開 |
| `scripts/verify.mjs` | 設計上の約束を 8 項目チェック |

### フォルダの移動

サイトの公開に必要なものを **`project/` 配下にすべて集約**した
（`index.html` / `package.json` / `vite.config.ts` / `src` / `public` / `scripts`）。
`.github/` だけは GitHub の仕様でリポジトリルートから動かせない。

## 2026-09-23 地図と地名を国土地理院に統一（ADR 0011）

| 変更 | 内容 |
|---|---|
| 削除 `src/adapters/geocode/nominatim.ts` | Nominatim をやめ、国土地理院に統一 |
| 削除 `src/adapters/geocode/offline.ts`, `prefectureCentroids.ts` | 予備の実装を持たない方針 |
| 追加 `src/adapters/geocode/gsi.ts` | 逆ジオコーダ＋市町村コード表、住所検索 |
| 変更 `src/adapters/map/maplibreStyle.ts` | OpenFreeMap のスタイル URL をやめ、地理院タイル（淡色地図）のスタイルをコードで組み立てる |
| 削除 `VITE_MAP_STYLE_URLS`, 背景色だけの代替地図 | 予備を持たない |
| 変更 `GeocodePort` | `providesCity` を削除（常に市町村まで返す） |
| 変更 `RuntimeHealth.mapFallback` → `mapUnavailable` | 代替に切り替える仕組みが無くなったため、意味を「取得できない」に変更 |
| 変更 `scripts/lib/enrich.mjs` | 取り込み側の地名取得も国土地理院に |
| 変更 `prefectureFromIsoCode` → `prefectureFromCode` | ISO コード（Nominatim 用）から都道府県コード（国土地理院の市町村コード先頭 2 桁）へ |

> **2026-09-24 追記**: GitHub Issue 経由の投稿・撮影リクエスト・通報は廃止した（T22）。この文書の Issue に関する記述は経緯として残している。今の書き込みは Firestore（`docs/00-architecture.md`）。

## 2026-09-24 タグの作り直し（ADR 0014）

移植元の感情タグは持ち込まない。コードの切り替えは T37〜T39 で行う。

| 移植元 | Loca | 状態 |
|---|---|---|
| 行動への影響（必須） | 廃止。種類の意味は「映っているもの」（必須）に移す | 済み（T37） |
| 動画の雰囲気（必須）・感情の核（必須） | 「雰囲気」（必須・6 択）に統合 | 済み（T37） |
| 感情の核でマーカー色 | 雰囲気でマーカー色。色覚の 3 型でも見分けられる 6 色 | 済み（T37） |
| タグの値は日本語の文字列 | 英小文字のキーで保存し、表示は i18n で訳す | 済み（T37） |
| — | 撮影の季節・時間帯・撮り方（任意）、現地メモ（任意・80 字）を追加 | 済み（T37・T38） |
| 撮影リクエストの「撮影雰囲気」 | 動画の「撮り方」と同じ語に置き換え | 済み（T39） |
| ランキングの感情タグ（全タグを OR） | 項目の中は OR、項目の間は AND | 済み（T38） |

## 2026-09-25 いいね（T29・ADR 0024）

| 移植元 | Loca | 状態 |
|---|---|---|
| `MarkerData.likeCount`（マーカーの項目） | マーカーには持たせない。件数は `likeCounts/{markerId}` に置き、マーカー情報を開いたときに読む。`youtube.likeCount` は YouTube の高評価数（ADR 0017）で、Loca のいいねとは別 | 済み（T29） |
| いいねした人の一覧 | 公開しない（本人と管理者だけが読める） | 済み（T29） |
| いいね数のランキング | 2026-09-26 に改め、人のタブで投稿者ごとの受け取ったいいね・炎の順に出す（ADR 0031。T89）。自分の投稿で受け取った件数も見られる | 未（T89） |
