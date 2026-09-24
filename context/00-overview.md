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
| 地図タイル | 地理院タイル（淡色地図） | 決定 |
| 地名 | 国土地理院の逆ジオコーダ・住所検索 | 決定 |
| 動画情報 | YouTube oEmbed（登録時）＋ YouTube Data API（毎晩・Actions だけ。ADR 0017） | 決定・実装済み |
| 定期処理 | GitHub Actions | 決定 |
| 動画本体 | 保存しない | 決定 |
| データベース | Firebase Firestore（Spark・請求先なし） | 決定・実装済み（ADR 0010） |
| 認証 | Firebase Auth の Google ログイン | 決定・実装済み（ADR 0010） |

**支払い方法を前提にしない。** Google Maps・Geocoding API・Cloud Functions は請求先が必須なので使わない。
`npm run verify` が Google Maps Platform の混入と、`src/adapters/firebase/` 以外からの Firebase の import を検出する。

## スコープ

現時点（2026-09-24 終業時）の範囲。右列は残タスク（`/tasks`）で実装する。

| 含む | まだ無い（タスク） |
|---|---|
| 地図・マーカー閲覧・検索・範囲指定検索、画面下の「フィルター」（ADR 0015） | 密集地のクラスタ（T41）、フィルターの共有 URL（T42） |
| タグ（映っているもの・雰囲気が必須。ADR 0014）、雰囲気 6 色のマーカー | 撮影リクエストへの回答（T43） |
| 撮影機器 4 段（分類 → メーカー → シリーズ → モデル。ADR 0018） | 機器マスタの画面での編集（T28） |
| 再生数・投稿日・長さ（毎晩 Actions が YouTube Data API で更新。ADR 0017）と、それを使うランキング・フィルタ | 合成メディア申告の除外（T44。前提が未確認） |
| 消えた動画の毎晩の論理削除、プロフィール登録（ニックネームと同意。ADR 0019） | 自分の投稿一覧（T53）、アカウント削除（T54）、チャンネルのバッジ（T55）、足あと（T45） |
| Google ログイン、マーカーの投稿・編集・削除（即時反映） | 管理者画面（T27。通報人数・定期タスクの表示を含む） |
| 撮影リクエスト（内訳・取り下げで熱量が戻る） | いいね（T29）、Edge AI 検索（T30）、特集（T46）、RSS（T47） |
| 通報（1 人 1 件で人数を数える。表示は続く） | |
| 統計とデータエクスポート、日本語・英語 | |

## 技術スタック

| 分類 | 採用 |
|---|---|
| 言語 | TypeScript 5.7（strict） |
| フレームワーク | React 18 + Vite 6 |
| パッケージマネージャ | npm |
| スタイル | Tailwind CSS 3（CDN ではなくビルドに含める） |
| 地図 | MapLibre GL JS + 地理院タイル |
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
