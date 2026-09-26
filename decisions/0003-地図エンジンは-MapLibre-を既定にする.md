# 0003. 地図エンジンは MapLibre を既定にする

- 状態: 一部置き換え（タイルとジオコーディングは [0011](0011-地図と地名を国土地理院に統一する.md)、現在は [0032](0032-地図と地名をOpenStreetMapに統一する.md)。MapLibre は継続）
- 日付: 2026-09-22

## 背景

移植元は Google Maps（AdvancedMarkerElement・Map ID）に依存していた。
Google Maps は API キーと課金アカウントが必須で、キーがないと地図が一切表示されない。
「内蔵ブラウザでローカル動作を確認できる構成にする」という要求を満たせない。

## 決定

`MapPort` を定義し、既定の実装を **MapLibre GL JS + OpenStreetMap ラスタタイル** にする。
Google Maps 実装も残し、`VITE_ADAPTER_MAP=google` と鍵の設定で切り替えられるようにする。

要件にある地図機能はすべて MapLibre 側でも実装する。

- カスタムピン（感情の核による色分け・熱量ラベル）→ `Marker({ element })` ＋ インライン SVG
- 矩形範囲指定検索 → GeoJSON ソース ＋ mousedown/mousemove/mouseup
- 情報ウィンドウ → `Popup`
- ズーム・移動の制限 → `minZoom` / `maxBounds`

## 結果

良くなること:

- 鍵ゼロで地図が出る。ヘッドレス Edge での自動確認もできた（ピン 20 件の描画を確認済み）。
- 地図ベンダのロックインが外れる。タイル URL を複数指定でき、1 ホストが落ちても描画が続く。

悪くなること:

- WebGL が必須。使えない環境では `probe()` が false を返し Google Maps 側へ回る。
- ジオコーディングが Google ほど正確でない。既定の `offline` 実装は都道府県までしか返さない。
  精度が要る運用では `nominatim` か `google` を選ぶ。
- OpenStreetMap の公式タイルは本番の大量アクセスに向かない。公開時は
  タイル提供元を `VITE_MAP_TILE_URLS` で差し替えること（この 1 行だけで済む）。
