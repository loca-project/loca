# Loca アーキテクチャ

## 決定済みの構成

| 層 | 採用 |
|---|---|
| ホスティング | GitHub Pages |
| 地図描画 | MapLibre GL JS |
| 地図タイル | 地理院タイル（淡色地図。APIキー・申請不要、出典の明示が条件） |
| 地名 | 国土地理院の逆ジオコーダ・住所検索（APIキー不要。非公式） |
| 動画情報 | YouTube oEmbed（APIキー不要） |
| 定期処理 | GitHub Actions |
| データベース | Firebase Firestore（Spark・請求先なし）。書き込みはすべてここ。閲覧の土台は毎晩作り直す JSON |
| 認証 | Firebase Auth の Google ログイン（ポップアップ方式） |
| 動画本体 | 保存しない（YouTube 埋め込み） |

支払い方法を前提にしない（ADR 0010）。Google Maps・Geocoding API・Cloud Functions は請求先が必須なので使わない。
`npm run verify` が Google Maps Platform の混入と、`src/adapters/firebase/` 以外からの Firebase の import を検出する。

## 一言でいうと

**サーバーを 1 台も持たない。** 閲覧の土台は GitHub Pages が配る静的 JSON、書き込みは Firestore（権限はセキュリティルール）、
毎晩の反映と定期処理は GitHub Actions が受け持つ。

```text
閲覧:  ブラウザ ──> GitHub Pages ──> dist/data/*.json ＋ Firestore の差分（onSnapshot。updatedAt > syncedAt）
投稿:  ブラウザ ──> Firebase Auth ──> Firestore（投稿・撮影リクエスト・通報。権限・重複・上限はルール）
反映:  Actions（毎日 0:00）──> Firestore を読んで markers.json / requests.json を再生成 ──> Pages に反映
```

同期より後の変更は、すべて updatedAt を進める書き込みで表す（論理削除）。だから差分の購読で取りこぼさない（ADR 0013）。

## ディレクトリ

```
Loca/                               ワークスペース（git の外）
├─ .claude/ CLAUDE.md package.json  Claude 設定と委譲コマンド
├─ tmp/                             一時ファイル
└─ project/                         ←← git リポジトリのルート
   ├─ .github/
   │  ├─ workflows/deploy.yml         push → ビルド → Pages
   │  ├─ workflows/sync-firestore.yml 毎日 Firestore → JSON 再生成 → Pages
   │  └─ workflows/publish.yml        ビルドと公開の共通部分
   ├─ index.html / package.json / vite.config.ts
   ├─ firestore.rules                セキュリティルール（生成物。rules/*.rules をつなぐ。ADR 0020）
   ├─ rules/                         セキュリティルールの部品（tests/ がエミュレータで検査）
   ├─ public/data/*.json             公開データ（Firestore から毎晩作り直す閲覧の土台）
   ├─ scripts/                       検証・同期・公開・管理
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
| `GeocodePort` | 座標 ⇄ 地名 | `gsi`（国土地理院） |
| `AuthPort` | Google ログイン・ログアウト・状態の購読 | `firebase-auth`（ポップアップ方式） |
| `MarkerStorePort` | マーカーの作成・本人の更新・論理削除・差分の購読 | `firestore`（レートリミットの印・動画の索引と同じバッチで書く。ADR 0012） |
| `RequestStorePort` | 撮影リクエストの作成・取り下げ（論理削除）・差分の購読 | `firestore-requests`（熱量の印と同じバッチで書く） |
| `ReportStorePort` | 通報（1 人 1 マーカー 1 件） | `firestore-reports` |

`AuthPort` と書き込みのポートは Firebase の設定値がそろったときだけ作られ、無ければ `null`（閲覧だけで動く）。
Firebase SDK は `src/adapters/firebase/index.ts` から遅延 import し、初期読み込みには含めない（`npm run verify` が検査する）。

書き込みは `MarkerStorePort`・`RequestStorePort`・`ReportStorePort` だけ。GitHub Issue 経由の投稿は 2026-09-24 に廃止した。

## データの形

`project/public/data/markers.json`

```json
{
  "generatedAt": 1758500000000,
  "syncedAt": 1758499990000,
  "markers": [
    {
      "id": "ozgGSNaaWI6TcMIgtqHC",
      "youtubeUrl": "https://www.youtube.com/watch?v=<11 文字>",
      "videoId": "<11 文字>",
      "lat": 35.69, "lng": 139.69,
      "tags": { "action": "...", "atmosphere": "...", "emotion": "..." },
      "equipment": { "manufacturer": "DJI", "series": "Mavic", "model": "Mavic 3 Pro" },
      "title": "...", "channelTitle": "...", "thumbnailUrl": "...",
      "prefecture": "東京都", "city": "台東区",
      "ownerUid": "<Firebase の uid>", "createdBy": "user-xxxxxx",
      "createdAt": 1758400000000, "updatedAt": 1758400000000
    }
  ]
}
```

`requests.json` も同じ形で、撮影リクエストの地点と、その内訳（`entries`: 熱量・季節・時間帯・撮り方・機器・`ownerUid`。季節・時間帯・撮り方は動画のタグと同じキー）を持つ。
`syncedAt` は「同期で Firestore を読み始めた時刻」で、画面はそれより後に `updatedAt` が変わった行だけを購読する。

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
| 地理院タイル | 地図が灰色になる。ピンと閲覧は続く。画面上部の帯で知らせる |
| 国土地理院の地名 API | 地名の取得と地名検索が使えない。登録は地名なしで続行（予備なし・ADR 0011） |

不調は画面上部の帯（`HealthNotice`）で知らせる。黙って劣化させない。Firestore が使えないときは閲覧だけで動く。

## 検証

```
npm run typecheck   # 型
npm run build       # ビルド
npm run verify      # 設計上の約束を 16 項目チェック
npm run check       # 上記 3 つをまとめて
```

`npm run verify` が見ているもの（出力の各行が 1 項目）:

- 廃止した依存が無い（src と package.json）。Firebase SDK の import は `src/adapters/firebase/` だけ
- `features/` と `core/` に地図 SDK の直接 import が無い。`import.meta.env` を読むのは `runtime/config.ts` だけ
- ソースに API キーが直書きされていない。`.env.example` 以外の `.env*` が git に無く、`.env.example` に値が無い
- すべてのソースが 400 行以内（CP-2）
- 公開データが読め、サンプルデータが混ざっていない
- 都道府県リストと撮影リクエストの地点のしきい値が、scripts と src で一致
- `dist/` が静的ファイルのみ。初期読み込みの JS に Firebase SDK が無く、260 kB 以内
