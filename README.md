# Loca

**地図に残す、あの場所の記録。**

自分で撮影した動画を、撮った場所とともに地図にピン留めして共有するコミュニティマップです。

🗺️ **https://loca-project.github.io/**

---

## どんなサイトか

日本地図の上に、誰かが「ここで撮った」動画のマーカーが並びます。
マーカーには撮影地の地名、そのとき感じたこと（感情タグ）、使った撮影機器が紐づいています。

- **地図から探す** — ピンをクリックすると動画とその場所の情報が出ます
- **絞り込む** — 地名やキーワードでの検索、地図上をドラッグしての範囲指定検索
- **ランキング** — 地域別・チャンネル別・機器別に、登録の多い順で見られます
- **撮影リクエスト** — まだ動画が無い場所に「ここを撮ってほしい」を投じられます

## 投稿するには

**GitHub アカウントがあれば誰でも投稿できます。** 専用の会員登録はありません。

1. サイトの地図をクリックして場所を選ぶ
2. YouTube の URL とタグを入力する
3. 「GitHub で投稿する」を押すと、入力済みの Issue フォームが開く
4. 内容を確認して送信
5. 管理者が確認のうえ承認すると、数分で地図に反映されます

[📮 投稿する（Issue 一覧）](../../issues)

### 投稿していただくときのお願い

登録する YouTube URL は、**ご自身が制作し正当な権利を保有するコンテンツ**に限ります。
第三者が制作した動画の登録はご遠慮ください。

不適切なマーカーを見つけたら、サイト上の「通報」ボタンからお知らせください。

## プライバシー

このサイトは**データベースを持ちません**。地図に出ているデータは、このリポジトリの
`public/data/` にある JSON ファイルそのものです。

したがって、

- **ログイン機能はありません。** 閲覧に個人情報は一切要りません
- **保持する個人情報は、投稿者の公開 GitHub アカウント名だけ**です
- **動画そのものは保存しません。** YouTube の埋め込みで再生します
- 誰がいつ何を追加したかは、すべて git の履歴として公開されています

## 仕組み

```
閲覧:  ブラウザ ──> GitHub Pages ──> data/*.json
投稿:  ブラウザ ──> GitHub Issue ──> Actions（検証・追記・push）──> Pages
```

サーバーを 1 台も持たず、GitHub だけで動いています。

| 層 | 使っているもの |
|---|---|
| ホスティング | GitHub Pages |
| 地図 | MapLibre GL JS + [OpenFreeMap](https://openfreemap.org/)（OpenStreetMap データ） |
| 動画情報 | YouTube oEmbed |
| 地名 | [Nominatim](https://nominatim.openstreetmap.org/)（OpenStreetMap） |
| データ | このリポジトリの JSON |

API キーは 1 つも使っていません。

## 開発

```
npm ci
npm run data:seed   # ローカル確認用のサンプルデータ
npm run dev         # http://127.0.0.1:5173
```

| コマンド | 内容 |
|---|---|
| `npm run check` | 型チェック＋ビルド＋設計上の約束の検査 |
| `npm run smoke` | 実ブラウザで地図が描画されるかを確認 |
| `npm run data:clear` | 公開データを空に戻す |
| `npm run deploy` | 検証して GitHub Pages へ公開 |

- アーキテクチャ: [docs/00-architecture.md](docs/00-architecture.md)
- 公開手順: [docs/70-publish.md](docs/70-publish.md)
- 要件定義: [docs/](docs/)
- 設計判断の記録: [decisions/](decisions/)

## クレジット

地図データ © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors /
タイル配信 [OpenFreeMap](https://openfreemap.org/) / [OpenMapTiles](https://openmaptiles.org/)
