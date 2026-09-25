# scripts/

このプロジェクト専用のスクリプトを置きます。

## `.claude/hooks/` との使い分け

| | `project/scripts/` | `.claude/hooks/` |
|---|---|---|
| 起動 | 人間または Claude が明示的に実行 | ハーネスがイベントで自動実行 |
| 用途 | セットアップ、データ変換、一括処理 | 整形、検証、ブロック、ログ |
| 失敗時 | 呼び出し元に伝わる | セッションを止めないよう握りつぶすのが基本 |

## 約束

- 実行方法をスクリプト先頭のコメントに書く。
- 破壊的な処理には `-WhatIf` / `--dry-run` 相当を用意する。
- 頻繁に使うものは `.claude/skills/` からラップすると `/名前` で呼べます。
- 子プロセスを `shell: true` で起動しない（`npm run verify` が検出）。npm は `process.execPath` と `npm_execpath` で、
  gh・git は `execFileSync` で直接起動する（T65。`release.mjs` の `npm()` が見本）。
- YouTube Data API の返り値を確かめるときは `npm run probe -- <動画ID> [--ref <枝>]`（キーは Actions の Secrets にだけある）。
- 本番の Firestore をオーナー権限で読むときは `npm run fs:read -- get <コレクション>/<ID>` か `list <コレクション> [--where 項目==値] [--sum 項目]`（書かない。uid・メールは伏せる。索引が要れば終了コード 3）。
- **`.ps1` は UTF-8 BOM 付きで保存する**（Shift-JIS 環境のため。詳細は `.claude/hooks/README.md`）。

## 一時スクリプトとの違い

その場限りの使い捨てスクリプトはここではなく `tmp/` に置きます。
`tmp/` 配下は権限ルールで無承認実行が許可されているため、自動化が止まりません。
