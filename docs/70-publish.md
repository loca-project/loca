# 公開手順（GitHub Pages）

## 初回だけ必要な作業

### 1. GitHub リポジトリを作る

**Public** で作る。Private だと GitHub Pages の無料枠が使えない。

### 2. ローカルを git リポジトリにして紐づける

**`project/` の直下**で実行する。ワークスペースのルート（`Loca/`）ではない。

```
cd project
git init -b main
git remote add origin https://github.com/<owner>/<repo>.git
```

**なぜ `project/` なのか**: GitHub はワークフローを
**リポジトリルート直下の `.github/workflows/`** でしか読まない。`.github/` は
`project/.github/` にあるため、リポジトリのルートも `project/` でなければ
デプロイも Issue 取り込みも動かない。

この構成の副次的な利点として、ワークスペース側の `.claude/`・`CLAUDE.md`・
`.mcp.json`・`tmp/` はリポジトリの外になり、**公開リポジトリに載らない**。

`npm run deploy` は実行時にルートが `project/` であることを確認し、
違っていれば理由を示して止まる。

### 3. GitHub Pages を有効にする

リポジトリの **Settings → Pages → Build and deployment → Source** を
**GitHub Actions** にする。（「Deploy from a branch」ではない）

### 4. Actions に書き込み権限を与える

Issue の取り込みが `public/data/*.json` を push するために必要。

**Settings → Actions → General → Workflow permissions** で
**Read and write permissions** を選ぶ。

### 5. ラベルを作る

- `approved` … これを Issue に付けると取り込みが走る
- `loca:marker` / `loca:request` / `loca:report` … Issue フォームが自動で付ける

## 公開データについて

`public/data/markers.json` と `requests.json` が公開される地図データそのもの。
**初期状態は空**で、マーカーは Issue の取り込みによってのみ増える。

| コマンド | 用途 |
|---|---|
| `npm run seed` | ローカル確認用のサンプル 20 件を入れる。**実在しない動画なので公開してはいけない** |
| `npm run data:clear` | 空に戻す。公開前に実行する |

`npm run verify` が `seed` で始まる ID を検出すると落ちるので、
サンプルを入れたまま公開することはできない（`npm run deploy` も途中で止まる）。

マーカーが 0 件のあいだは、地図の上に「まだ登録がありません」という案内が出る。

- 1 件でも登録されれば自動的に消える
- 閲覧しかしない人のために、**× または「地図を見る」で閉じられる**
- 閉じたことは localStorage に残るので、再読み込みしても出てこない
  （端末・ブラウザ単位。記録を消せばまた出る）

## 毎回の公開

**1 コマンド**。`project/` でも、ワークスペースのルート（委譲される）でも実行できる。

```
npm run deploy
```

`project/scripts/deploy.mjs` が順に実行する。

1. `npm run typecheck`
2. `npm run build`
3. `npm run verify`
4. `git add -A` → `git commit` → `git push`

**3 まででエラーが出たら push しない。** 壊れたものを公開しないため。

コミットメッセージを指定したいときは次のようにする。

```
npm run deploy -- "地図タイルを差し替え"
```

push すると `.github/workflows/deploy.yml` が走り、数分で Pages に反映される。
進捗はリポジトリの **Actions** タブで見られる。

## Firestore のルールの反映

ルールの本体は `project/firestore.rules`（方式は ADR 0012）。サイトの公開（`npm run deploy`）とは**別の操作**で、
Actions も反映しない。`firestore.rules` を変えたら、次の手順で本番の `loca-d3792` に反映する。

1. Firebase CLI にログインする（初回と、トークンが切れたとき）。`loca-d3792` のオーナーのアカウントを選ぶ。

   ```powershell
   npx --prefix project firebase login --reauth
   ```

2. 反映する。エミュレータのテスト（`npm run test:rules`。JDK 11 以上が要る）が通ったときだけ反映される。

   ```powershell
   npm --prefix project run deploy:rules
   ```

3. Firebase コンソールの **Firestore → ルール** で、中身が `firestore.rules` と一致することを確かめる。

戻すときは、コンソールの **ルール** の履歴から前の版を選んで公開する。

### 管理者を足す・外す

最初の管理者は、ルールでは誰も作れない（ADR 0012）。Firebase CLI にログイン中のオーナーの権限で、スクリプトが直接書く
（セキュリティルールではなく IAM で判定される経路）。相手は一度サイトにログインしている必要がある。

| 操作 | コマンド |
|---|---|
| 一覧 | `npm run admin:list` |
| 追加 | `npm run admin:add -- <メールアドレスか uid>` |
| 削除 | `npm run admin:remove -- <メールアドレスか uid>` |

CLI のログインが切れていたら、上の手順 1（または `/firebase-rules` の手順 2）でログインし直す。
ルールは `admins/{uid}` の有無だけを見るので、中身（`note`・`addedAt`）は記録用。

## ワークフローの構成

4 本に分かれている。分けているのは GitHub の仕様上の制約による。

| ファイル | いつ動くか | 何をするか |
|---|---|---|
| `publish.yml` | 他から呼ばれたときだけ | ビルド → 検証 → Pages へ公開 |
| `deploy.yml` | `main` に push したとき | `publish.yml` を呼ぶ |
| `ingest-issue.yml` | Issue に `approved` が付いたとき | 取り込み → commit/push → `publish.yml` を呼ぶ |
| `sync-firestore.yml` | 毎日 0:00（日本時間）と手動 | Firestore から `markers.json` を作り直す → 変更があれば commit/push → `publish.yml` を呼ぶ |

**なぜ取り込み側から直接 publish を呼ぶのか**: GitHub には
「`GITHUB_TOKEN` による push は他のワークフローを起動しない」という再帰防止の仕様がある。
取り込みが push しても `deploy.yml` は動かないため、取り込み側が自分で公開まで面倒を見る。

**Firestore からの同期**（要件 1.3・1.4）: `markers` はルールで誰でも読めるので、API キー（Variables の公開値）だけで読む。
秘密情報は使わない。論理削除の行は除き、Issue 経由の行は残す。`markers.json` の `syncedAt` が
「読み始めた時刻」で、アプリはそれより後の変更だけを onSnapshot で購読する。

| 操作 | コマンド |
|---|---|
| 手元で件数だけ確かめる | `npm run data:sync:check` |
| 本番で今すぐ同期する | `gh workflow run sync-firestore.yml` → `gh run watch` |

## 公開 URL

| リポジトリ名 | URL |
|---|---|
| `<owner>.github.io` | `https://<owner>.github.io/` |
| それ以外（例 `loca`） | `https://<owner>.github.io/loca/` |

`vite.config.ts` の `base` は `'./'`（相対）なので、どちらでもそのまま動く。

## 投稿が地図に載るまで

```
利用者: サイトで入力 → 「GitHub で投稿する」
          ↓
       Issue が作成される（loca:marker ラベル付き）
          ↓
メンテナ: 内容を確認して `approved` ラベルを付ける
          ↓
       ingest-issue.yml が検証 → public/data/markers.json に追記 → push
          ↓
       同じワークフローが publish.yml を呼び、Pages に反映（数分）
          ↓
       Issue に結果がコメントされ、成功なら自動でクローズ
```

検証に落ちた場合は Issue にその旨がコメントされる。
内容を直して `approved` を付け直せば再試行できる。

## 動作確認

**公開前に必ず実行する。**

```
npm run preview   # 別のターミナルで
npm run smoke
```

`smoke` は実ブラウザを起動し、**地図タイルが実際に取得されたか**を数えて判定する。
DOM の文字列やピンの数だけを見ていると、地図が真っ白でも通ってしまう
（マーカーは HTML 要素なので地図が壊れていても描画される）。実際にこれで一度見逃した。

スクリーンショットが `tmp/smoke.png` に出るので、**目視でも確認すること。**

公開済みの URL に対しても実行できる。

```
npm run smoke -- https://<owner>.github.io/<repo>/
```

公開後、実際の URL で次を確認する。

| 確認項目 | 期待 |
|---|---|
| 地図が表示される | 地理院タイル（淡色地図）が出る。右下に「地理院タイル」の出典 |
| ピンが出る | markers.json の件数ぶん |
| ピンをクリック | サイドメニューがマーカー情報になる |
| ランキングタブ → 適用 | 結果パネルに件数順で並ぶ |
| 地図をクリック | 投稿フォームが開く |
| 「GitHub で投稿する」 | Issue フォームが入力済みで開く |
| 右上のバッジ | 「最新」と生成日時が出る |

## 困ったとき

| 症状 | 原因と対処 |
|---|---|
| `Permission to <owner>/<repo>.git denied to <別名>` / 403 | Windows に**別の GitHub アカウント**の資格情報がキャッシュされている。下記参照 |
| 404 になる | Settings → Pages の Source が「GitHub Actions」か確認 |
| 地図が灰色のまま | バッジが「注意」なら地理院タイルに到達できていない。「最新」のままなら地図の表示位置がおかしい可能性（`maxBounds` の罠。[ADR 0007](../decisions/0007-maxBoundsを使わない.md) 参照）|
| ピンが出ない | `project/public/data/markers.json` が空。`npm run seed` で復旧できる |
| 投稿ボタンが出ない | `VITE_GITHUB_REPO` が空。Actions ビルドなら自動設定されるので、ローカル確認時のみ `.env.local` に設定する |
| 取り込みが動かない | Workflow permissions が Read and write か、`approved` ラベルがあるか確認 |
