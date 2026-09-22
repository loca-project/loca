# Loca アーキテクチャ

## 決定済みの構成

| 層 | 採用 |
|---|---|
| ホスティング | GitHub Pages |
| 地図描画 | MapLibre GL JS |
| 地図タイル | OpenFreeMap（APIキー不要・無制限・商用可） |
| 動画情報 | YouTube oEmbed（APIキー不要） |
| 定期処理 | GitHub Actions |
| データベース | **使わない**（GitHub リポジトリ上の JSON が唯一の保存先） |
| 認証 | **使わない**（GitHub アカウントが本人確認を兼ねる） |
| 動画本体 | 保存しない（YouTube 埋め込み） |

Google API と Firebase は使わない。関連コードはすべて削除済みで、
`npm run verify` が再混入を検出する。

## 一言でいうと

**サーバーを 1 台も持たない。** 地図に出ているデータは GitHub リポジトリ上の JSON
そのもので、書き込みは Issue、反映は Actions、配信は Pages が受け持つ。

```
閲覧:  ブラウザ ──> GitHub Pages ──> dist/data/*.json
投稿:  ブラウザ ──> GitHub Issue ──> Actions（検証・追記・push）──> Pages に反映
```

## ディレクトリ

```
Loca/                               ワークスペース（git の外）
├─ .claude/ CLAUDE.md package.json  Claude 設定と委譲コマンド
├─ tmp/                             一時ファイル
└─ project/                         ←← git リポジトリのルート
   ├─ .github/
   │  ├─ workflows/deploy.yml        push → ビルド → Pages
   │  ├─ workflows/ingest-issue.yml  Issue → JSON 追記
   │  └─ ISSUE_TEMPLATE/*.yml        投稿フォーム
   ├─ index.html / package.json / vite.config.ts
   ├─ public/data/*.json             公開データ（= データベースの代わり）
   ├─ scripts/                       検証・取り込み・公開
   ├─ src/
   │  ├─ core/       依存ゼロ。型・定数・純粋ロジック
   │  ├─ ports/      インターフェース定義
   │  ├─ adapters/   実装。外部 SDK を import してよいのはここだけ
   │  ├─ runtime/    設定とサービス解決
   │  ├─ features/   画面
   │  ├─ shared/     共通 UI とフック
   │  └─ app/        画面の組み立てと状態
   └─ context/ docs/ decisions/ references/   資料
```

**git リポジトリのルートは `project/` 自身。** GitHub はワークフローを
リポジトリルート直下の `.github/` でしか読まないため、この位置しかありえない。
結果として、ワークスペース側の設定は公開リポジトリに含まれない。

## ポート一覧

| ポート | 責務 | 実装 |
|---|---|---|
| `CatalogPort` | 公開データの読み取り | `static`（public/data/*.json） |
| `MapPort` | 地図の描画・ピン・情報ウィンドウ・矩形描画 | `maplibre` |
| `VideoMetaPort` | 動画メタデータの取得 | `oembed` |
| `GeocodePort` | 座標 ⇄ 地名 | `nominatim` → `offline` |

書き込み用のポートは無い。書き込みは `features/contribute/issueUrl.ts` が
GitHub Issue フォームの URL を組み立てるだけで、保存はしない。

## データの形

`project/public/data/markers.json`

```json
{
  "generatedAt": 1758500000000,
  "markers": [
    {
      "id": "mk_12",
      "youtubeUrl": "https://www.youtube.com/watch?v=...",
      "lat": 35.69, "lng": 139.69,
      "tags": { "action": "...", "atmosphere": "...", "emotion": "..." },
      "equipment": { "manufacturer": "DJI", "series": "Mavic", "model": "Mavic 3 Pro" },
      "title": "...", "channelTitle": "...", "thumbnailUrl": "...",
      "prefecture": "東京都", "city": "台東区",
      "createdBy": "github-username",
      "createdAt": 1758400000000
    }
  ]
}
```

`requests.json` も同じ形で、撮影リクエストの地点と内訳を持つ。

## ランキングの基準を変えた理由

Google API を使わないため、**再生数・動画投稿日・再生時間は取得できない**
（oEmbed が返すのは タイトル / チャンネル / サムネイル の 3 項目のみ）。

そこで基準を Loca 内の指標に置き換えた。

| 元の要件 | 現在 |
|---|---|
| 再生数の降順 | 登録件数の降順（同数なら新しい順） |
| 地域別＝再生数 | 地域別＝都道府県ごとの**登録件数** |
| チャンネル別＝再生数合算 | チャンネル別＝**登録本数** |
| 機器別＝再生数 | 機器別＝組み合わせごとの**登録件数** |
| 動画投稿日フィルタ | **Loca への登録日**フィルタ |
| 動画の長さフィルタ | **削除**（取得手段が無い） |

外部 API に依存しないので、markers.json だけで常に正確な結果が出る。

## 可用性

サーバーが無いので「落ちる」対象が少ない。残る依存は 3 つだけ。

| 依存 | 落ちたとき |
|---|---|
| GitHub Pages | サイト全体が見られない（代替なし） |
| OpenFreeMap | スタイル URL を順に試し、最後は背景色だけの地図で操作を継続 |
| Nominatim | `offline` 実装（県庁所在地の最近傍）に自動で切り替え |

状態は画面右上のバッジに出す。黙って劣化させない。

## 検証

```
npm run typecheck   # 型
npm run build       # ビルド
npm run verify      # 設計上の約束を 8 項目チェック
npm run check       # 上記 3 つをまとめて
```

`npm run verify` が見ているもの:

1. 廃止した依存（Firebase / Google Maps / YouTube Data API / TensorFlow）が無い
2. package.json にも残っていない
3. `features/` と `core/` に地図 SDK の直接 import が無い
4. `import.meta.env` を読むのは `runtime/config.ts` だけ
5. ソースに API キーが直書きされていない
6. すべてのソースが 400 行以内（CP-2）
7. 公開データが読める
8. `dist/` が静的ファイルのみ
