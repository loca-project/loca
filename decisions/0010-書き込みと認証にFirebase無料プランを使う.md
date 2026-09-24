# 0010. 書き込みと認証に Firebase（無料の Spark プラン）を使う

- 状態: 採用
- 日付: 2026-09-23
- 置き換え: [0005](0005-GitHubだけで完結させる.md) の書き込みと本人確認の部分、
  [0009](0009-サイト上の認証は見送る.md) の全体

## 背景

Loca は **Geo（範囲指定検索・地名の取得）とユーザー認証を備えた動的サイト**として
動くことが前提である。0005 の「GitHub だけで完結」構成では次が満たせなかった。

- サイト上でのログイン（0009 で、トークン交換にサーバーが要るため見送り）
- 投稿の即時反映、いいね、本人によるマーカーの更新・削除、管理者モード
- 一般利用者の投稿（GitHub アカウントが要り、敷居が高い）

別のプロジェクトで Google のサービスを使うことになったため、Firebase を再検討した。
条件は **支払い方法（請求先アカウント）を登録しないこと**。

## 調査結果（2026-09-23 時点）

### Spark プランで使えるもの

| 製品 | Spark | 無料枠 |
|---|---|---|
| Authentication（Google ログイン） | ○ | 50,000 MAU |
| Cloud Firestore | ○ | 保存 1 GiB / 読み取り 5 万回/日 / 書き込み 2 万回/日 / 削除 2 万回/日 / 転送 10 GiB/月 |
| App Check | ○ | 上限あり |
| Hosting | ○ | 使わない（GitHub Pages のまま） |
| Cloud Functions | **✗** | — |
| Cloud Storage | **✗**（2026-02-03 以降は Blaze 必須） | — |

上限を超えると、その日の枠が戻るまで該当の操作が失敗する。**課金は発生しない。**

### 要件ごとの実装可否

| 要件 | 実装方法 | 判定 |
|---|---|---|
| 1.1 Google 認証 | Firebase Auth の `signInWithPopup`。承認済みドメインに GitHub Pages のドメインを追加する | ○ |
| 1.1 未認証では登録・編集させない | UI で導線を隠す ＋ セキュリティルールで `request.auth` が無い書き込みを拒否する | ○ |
| 3.x 本人のみ更新・論理削除 | ルールで `resource.data.ownerUid == request.auth.uid` を検査する | ○ |
| 5.x 管理者モード | `admins/{uid}` の存在をルールで検査する。管理者の追加は管理者だけが書ける | ○ |
| 5.x ブラックリスト | ルールで `blacklist/{uid}` があれば書き込みを拒否する。ログイン直後にアプリが判定してサインアウトする | △ |
| 1.4 差分のリアルタイム反映 | `onSnapshot` で `updatedAt > markers.json の generatedAt` を監視する | ○ |
| 3.x 範囲指定検索（Geo-Fence） | 現行どおりクライアントで判定する（`src/core/logic/geo.ts`）。Firestore 側で絞る場合も、緯度・経度の複数範囲条件か geohash で可能 | ○ |
| 3.x 都道府県・市町村の取得 | 国土地理院の逆ジオコーダ（[0011](0011-地図と地名を国土地理院に統一する.md)） | ○ |
| 1.3 定時バッチ | GitHub Actions ＋ Admin SDK で Firestore を読み、`markers.json` を再生成する | ○ |
| 1.3 ユーザー単位のレートリミット | ルールで直前の書き込み時刻（`request.time` と比較）を検査する | ○ |
| 1.3 IP 単位のレートリミット | ルールは IP を参照できない。GitHub Pages には WAF が無い | **✗**（従来どおり未実装） |

判定が △・✗ の理由:

- **ブラックリストでログイン自体を止める**には、ブロッキング関数（Identity Platform ＋ Cloud Functions）が要る。
  Spark では使えない。ただし書き込みはルールで止めるので、データは守れる。
- **Google Geocoding API は使えない。** 無料の範囲の利用でも請求先アカウントの設定が必須である。
- **`signInWithRedirect` は Firebase 以外のドメインでは、ブラウザのストレージ分離のため動かない。**
  回避にはプロキシかヘルパーの自前配置が要る。GitHub Pages ではポップアップ方式を使う。

## 決定

1. **Loca 専用の Firebase プロジェクトを新しく作り、Spark のまま運用する。**
   - 請求先アカウントをリンクしない。他のプロジェクトの Google Cloud プロジェクトに相乗りしない。
   - 移植元の Firebase プロジェクトは使い回さない（`constants.ts` に実キーが直書きされていた）。
   - Firestore のロケーションは `asia-northeast1`（東京）にする。作成後は変えられない。
2. **配信は GitHub Pages のまま**にする。Firebase Hosting は使わない。
   - 決め手は **GitHub Actions が使えること**。Spark では Cloud Functions も定期実行も使えないため、
     `markers.json` の再生成を担える場所が Actions しかない。Pages なら生成物の push がそのまま公開になる。
   - 代わりに失うのはリダイレクト方式のログインだけ（ポップアップ方式で代替する）。
     転送量も Pages（100 GB/月）が Hosting（360 MB/日）より多い。
3. **認証は Firebase Auth の Google ログインのみ**にする。方式は `signInWithPopup` とする。
4. **Firestore を書き込みの一次ソースにする。** 閲覧の土台は `markers.json` のまま（[0004](0004-静的JSONを一次ソースにする.md)）。
   - 閲覧で Firestore を全件読まない（読み取り 5 万回/日の枠を守るため）。
   - `markers.json` は GitHub Actions が Firestore から毎日作り直す。差分は `onSnapshot` で埋める。
5. **権限はすべてセキュリティルールで守る。** クライアントの判定は表示の切り替えにしか使わない。
6. **Geo は国土地理院に統一する**（[0011](0011-地図と地名を国土地理院に統一する.md)）。範囲検索はクライアントで判定する。
   Google Maps Platform（Maps・Geocoding）は請求先アカウントが必須なので使わない。
7. **Firebase SDK を import してよいのは `src/adapters/firebase/` だけ**にする（[0002](0002-ポートとアダプタで外部依存を隔離する.md)）。
8. **GitHub Issue 経由の投稿は、Firestore への移行が終わった時点で廃止する。** 併存させると一次ソースが 2 つになる。
   → 2026-09-24 に廃止した（T22。フォーム・取り込みのワークフローとスクリプト・画面の分岐を撤去し、通報も Firestore へ）。

## 検討した代替案

- **0005 のまま（GitHub だけで完結）**: サイト上の認証にはサーバーが要る（0009）。
  即時反映といいねも実現できない。前提（動的サイト）を満たせない。却下。
- **Cloudflare Workers で GitHub OAuth を中継する（0009 の再検討案）**: 認証は通るが、
  データベースが無いので即時反映・いいね・本人による更新は解決しない。却下。
- **Supabase**: 機能は同等。ただし 7 日間アクセスが無いと停止する。
  Google のサービスをすでに使う方針と合わせるほうが、管理するアカウントが増えない。却下。
- **Firebase の Blaze プラン**: Cloud Functions・Storage・ブロッキング関数が使える。
  ただし支払い方法の登録が必要で、条件に反する。却下。

## 結果

良くなること:

- サイト上でログインでき、一般の Google アカウントで投稿できる。
- 投稿が即時に反映される。いいね、本人による更新・削除、管理者モードを戻せる。
- 請求先が無いので、どれだけ使われても請求は来ない。
- `markers.json` を土台に残すので、Firebase が止まっても閲覧とランキングは成立する。

悪くなること:

- **無料枠を超えると書き込みが止まる。** 枠が戻るまで（太平洋時間の 0 時、日本時間の 16〜17 時）投稿できない。
- **GitHub Actions に Firestore を読む認証情報が要る。** 0005 の「鍵の管理が無い」は失われる。
- Firestore のデータ形式に依存する。ポート越しに隔離するので、影響は `src/adapters/firebase/` に収まる。
- ブラックリストの利用者もログイン自体はできる（書き込みはできない）。
- IP 単位のレートリミットは引き続き実装できない。
- ポップアップ方式は、モバイルでブロックされることがある。

## 未確認のこと

- ~~ルールの動作を実機で確かめていない。~~ 2026-09-24 にエミュレータ（JDK 25）で確認済み。
  方式と結果は [0012](0012-Firestoreのデータ形とルールの方式.md)。本番の Firestore へのルールの反映は未実施。
- 実際の読み取り・書き込みの回数（利用者数が未定のため見積もれない）。
- Admin SDK からの読み取りが、Spark の無料枠の同じ枠から引かれるかどうか。
- Spark で作れるプロジェクトの数の上限。

## Firebase プロジェクトの状態（2026-09-23 コンソールで設定済み）

いずれも公開して差し支えない識別子。`apiKey` などの設定値は `.env.local` に置き、ここには書かない。

| 項目 | 値 |
|---|---|
| プロジェクト ID | `loca-d3792`（Spark・請求先アカウントなし） |
| Firestore | `(default)` / `asia-northeast1` / Standard（ネイティブ）/ リアルタイム更新 有効 |
| Firestore ルール | 本番環境モードの初期状態（`allow read, write: if false;`）。ルールは今後リポジトリで管理する |
| Authentication | Google ログイン 有効。Identity Platform へのアップグレードはしていない |
| 承認済みドメイン | `localhost` / `loca-d3792.firebaseapp.com` / `loca-d3792.web.app` / `loca-project.github.io` |
| ウェブアプリ | `loca-web`（Firebase Hosting は未設定） |
| Google アナリティクス | プロジェクトでは**有効**（利用者の判断）。サイトで `getAnalytics()` を呼ぶかは**未決定** |

コンソールで確認できた制約: 「ブロッキング関数」は Identity Platform が必要なため鍵アイコンで使えない。

## この決定に合わせて直すもの

2026-09-23 に済ませたもの:

| ファイル | 直したこと |
|---|---|
| `CLAUDE.md`（ワークスペース） | Firebase の禁止を外し「決定済み・未実装」に。請求先が必須のサービスを使わないことを明記 |
| `.claude/rules/10-project-policy.md` | 決定済みの表、使わないものの表、Issue 経由の節を「移行までの暫定」に |
| `scripts/verify.mjs` | `firebase` を禁止リストから外し、`src/adapters/firebase/` 以外での import を検出する検査を追加。`maps.googleapis.com` を禁止に追加 |
| `docs/00-architecture.md` `docs/10-requirements-common.md` `context/00-overview.md` `README.md`（ワークスペース） | 構成の記述。現在の動作と実装後の形を分けて書いた |

実装のときに直すもの（未着手）:

| ファイル | 直すこと |
|---|---|
| ~~`src/ports/`~~ | 2026-09-24 済み。`AuthPort`・`MarkerStorePort` を追加し、`catalog.ts` の説明を直した |
| `project/README.md` の「プライバシー」 | 「ログイン機能はありません」「保持するのは GitHub アカウント名だけ」が事実でなくなる |
| `README.md`（ワークスペース）の「制約」 | 解消した項目を消す |
| ~~`.github/workflows/ingest-issue.yml` ほか Issue 経由の一式~~ | 2026-09-24 に廃止（決定 8） |

## 出典

- Firebase の料金: https://firebase.google.com/pricing
- Cloud Storage の Blaze 必須化: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- リダイレクト方式の制約: https://firebase.google.com/docs/auth/web/redirect-best-practices
- ブロッキング関数の前提: https://firebase.google.com/docs/auth/extend-with-blocking-functions
- Firestore の地理クエリ: https://firebase.google.com/docs/firestore/solutions/geoqueries
- Firestore の複数フィールドの範囲条件: https://firebase.google.com/docs/firestore/query-data/multiple-range-fields
- Geocoding API の請求先アカウント必須: https://developers.google.com/maps/documentation/geocoding/usage-and-billing
- Maps JavaScript API の請求先アカウント必須: https://developers.google.com/maps/documentation/javascript/usage-and-billing
- Cloud Functions の Blaze 必須: https://firebase.google.com/docs/functions/get-started
- Emulator の Java 要件: https://firebase.google.com/docs/emulator-suite/install_and_configure

確かめ方: 上の出典ページで Spark の各行と △・✗ の根拠を照合する。
実装後は、エミュレータでのルールのテストが「要件ごとの実装可否」の ○ の行をすべて通ること。
