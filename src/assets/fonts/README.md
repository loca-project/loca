# サイト名 Loca の書体

サイドメニュー上部の「Loca」だけに使う（ADR 0026・0027）。

| 項目 | 値 |
|---|---|
| ファイル | `fraunces-loca.woff2`（1,348 バイト。静的。表に `fvar`・`gvar` が無い） |
| 書体 | Fraunces（Undercase Type ほか）。ライセンスは [OFL.txt](OFL.txt)（SIL Open Font License 1.1、予約フォント名なし） |
| 軸の値 | `opsz` 24・`wght` 600・`SOFT` 100・`WONK` 0 |
| 含む文字 | L・o・c・a の 4 文字と、Google Fonts の `text=` が足す空白 |
| 取得日 | 2026-09-25 |

4 kB 未満なので、ビルドが CSS に埋め込む（Vite の `assetsInlineLimit`）。書体のための別の通信は起きない。

## 取り直すとき

Google Fonts の CSS API で文字を絞って取得する。ブラウザの User-Agent を付けないと woff2 ではなく TrueType が返る。

```text
https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@24,600,100,0&text=Loca
```

返った CSS の `src: url(...)` を同じ User-Agent で取得し、`fraunces-loca.woff2` を置き換える。
静的か可変かは、woff2 の表の一覧に `fvar` があるかで確かめる。
