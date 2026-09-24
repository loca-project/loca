# 0017. YouTube Data API と Firestore への書き込みは Actions から、鍵ファイルなしで行う

- 状態: 採用
- 日付: 2026-09-24
- 関連: [0006](0006-ランキング基準をLoca内の指標に変える.md)、[0010](0010-書き込みと認証にFirebase無料プランを使う.md)、[0014](0014-タグを人にしか書けない情報に絞る.md)

## 背景

再生数・動画の投稿日・再生時間は YouTube oEmbed では取れず、YouTube Data API v3 でしか取れない（ADR 0006）。
消えた動画の論理削除（T24）と合成メディア申告の除外（T44）には、日次で Firestore に書く経路も要る。

制約は 2 つある。

- 支払い方法（請求先アカウント）を前提にしない（ADR 0010）。
- 秘密の値をブラウザに配らない。サービスアカウントの鍵ファイルも作らない（漏れたときに取り消すまで使われ続けるため）。

## 決定

1. **YouTube Data API は GitHub Actions からだけ呼ぶ。** API キーは YouTube Data API だけに制限し、GitHub Secrets（`YOUTUBE_API_KEY`）に置く。
   `src/` からの呼び出しは `npm run verify` が禁止する。
2. **Actions から Firestore への書き込みは Workload Identity 連携で行う。** GitHub の OIDC トークンを、
   このリポジトリの Actions に限ってサービスアカウント `loca-actions` に交換する。鍵ファイルは作らない。
   サービスアカウントの権限は `roles/datastore.user`（Firestore の読み書き）だけ。
3. 設定は `scripts/setup-google.mjs` が作る（何度流しても同じ結果になる）。Firebase CLI のオーナーのログインで動く。
4. 届くかどうかは手動のワークフロー `probe-google.yml` で確かめる。

### 作ったもの（loca-d3792）

| 種類 | 名前 | 置き場所・権限 |
|---|---|---|
| 有効化した API | youtube・iam・iamcredentials・sts・apikeys・cloudresourcemanager | — |
| API キー | `loca-youtube`（YouTube Data API だけ） | GitHub Secrets `YOUTUBE_API_KEY` |
| サービスアカウント | `loca-actions@loca-d3792.iam.gserviceaccount.com` | プロジェクトに `roles/datastore.user` |
| Workload Identity プール | `github`、プロバイダ `loca-repo`（条件: `assertion.repository == 'loca-project/loca-project.github.io'`） | サービスアカウントに `roles/iam.workloadIdentityUser` |
| GitHub Variables | `GCP_WORKLOAD_IDENTITY_PROVIDER`、`GCP_SERVICE_ACCOUNT` | 公開してよい識別子だけ |

請求先が無効のまま、上の API をすべて有効化できた（2026-09-24 に確認）。
YouTube Data API の既定の割り当ては 1 日 10,000 ユニット（公式の Quota ガイド）。`videos.list` は 1 回 1 ユニットで、
50 本ずつまとめて取れるので、マーカー 1 万件でも 1 日 200 ユニットで済む。

### 消し方（戻す手順）

1. GitHub: `gh secret delete YOUTUBE_API_KEY` と `gh variable delete GCP_WORKLOAD_IDENTITY_PROVIDER` `GCP_SERVICE_ACCOUNT`（`-R loca-project/loca-project.github.io`）
2. Google Cloud コンソール（loca-d3792）: 「API とサービス → 認証情報」で `loca-youtube` を削除、
   「IAM → Workload Identity 連携」でプール `github` を削除、「IAM → サービスアカウント」で `loca-actions` を削除
3. 必要なら「API とサービス」で有効化した API を無効に戻す

## 検討した代替案

- **ブラウザから YouTube Data API を呼ぶ**: キーを配ることになり、割り当てを他人に使い切られる。却下。
- **サービスアカウントの鍵ファイルを Secrets に置く**: 漏れたら取り消すまで使われる。Google も非推奨。却下。
- **Cloud Functions で定期実行**: Blaze（請求先）が要る。却下（ADR 0010）。

## 結果

- T24（再生数などの日次更新・消えた動画の論理削除）と T44（合成メディア申告の除外）が、この経路で書ける。
- 再生数などを使う機能を戻せる（T25。ADR 0006 の見直し）。

## 確かめ方

`gh workflow run probe-google.yml -R loca-project/loca-project.github.io` が成功し、ログに `6 / 6 件 OK` が出る。
