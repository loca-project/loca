# プロジェクト概要

## 何を作るか

**Loca** — 地図上に YouTube 動画を紐づけて共有するコミュニティマップ。
Google AI Studio で作った「Chronos MAP」を移植し、サイト名を Loca に変更したもの。

## なぜ作るか

元の Chronos MAP は Firebase と Google Maps に密結合しており、
**公開先を変えるとコードごと書き直し**になる状態だった。
本プロジェクトは、機能の中核を保ったまま**外部サービスへの依存を最小化**して作り直す。

## 決定済みの構成

| 層 | 採用 | 状態 |
|---|---|---|
| ホスティング | GitHub Pages | 決定 |
| 地図描画 | MapLibre GL JS | 決定 |
| 地図タイル | OpenFreeMap | 決定 |
| 動画情報 | YouTube oEmbed | 決定 |
| 定期処理 | GitHub Actions | 決定 |
| 動画本体 | 保存しない | 決定 |
| データベース | 使わない（GitHub 上の JSON） | 見送り済み |
| 認証 | 使わない（GitHub アカウント） | 見送り済み |

**Google API と Firebase は使わない。** 関連コードは削除済みで、
`npm run verify` が再混入を検出する。

## スコープ

| 含む | 含まない |
|---|---|
| 地図・マーカー閲覧・検索・範囲指定検索 | 再生数／動画投稿日／再生時間の表示（取得手段が無い） |
| ランキング 4 種（地域・チャンネル・機器・リクエスト） | いいね（共有される可変状態を持てない） |
| GitHub Issue 経由の投稿・撮影リクエスト・通報 | サイト上での即時反映（Issue 経由で数分かかる） |
| 統計とデータエクスポート | ユーザー管理・アクセス制限（DB が無い） |
| 日本語・英語 | GitHub アカウントを持たない人の投稿 |

## 技術スタック

| 分類 | 採用 |
|---|---|
| 言語 | TypeScript 5.7（strict） |
| フレームワーク | React 18 + Vite 6 |
| パッケージマネージャ | npm |
| スタイル | Tailwind CSS 3（CDN ではなくビルドに含める） |
| 地図 | MapLibre GL JS + OpenFreeMap |
| データ | `project/public/data/*.json`（GitHub リポジトリ上） |
| テスト | `npm run check`（型・ビルド・設計検証の 3 点） |

## 構成

サイトの実体は **`project/` 配下にすべて**ある。**git リポジトリのルートも `project/` 自身**で、
`.github/` はその直下（GitHub がリポジトリルートでしかワークフローを読まないため）。
ワークスペース側の `.claude/` や `CLAUDE.md` はリポジトリの外なので公開されない。
公開は 1 コマンド（`npm run deploy`）。

詳しくは [project/docs/00-architecture.md](../docs/00-architecture.md)。

## 動かし方

```
npm run setup   # 依存のインストール
npm run seed    # サンプルデータ（初回のみ）
npm run dev     # http://127.0.0.1:5173
npm run deploy  # 検証して GitHub Pages へ公開
```

## 関連ドキュメント

- アーキテクチャ: `project/docs/00-architecture.md`
- 公開手順: `project/docs/70-publish.md`
- 要件定義（5 分冊）: `project/docs/10〜50-requirements-*.md`
- 移植対応表: `project/docs/60-migration-map.md`
- 設計判断の記録: `project/decisions/`
