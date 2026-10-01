# Phase 8B：Feature API

## 目的

Free / Proコード分割より先に、Pro候補機能の利用可否を問い合わせる共通入口を設ける。Phase 8Bでは製品・ライセンス・Proアドオンを判定せず、既存機能の表示・保存・動作を変えない。

## PHP API

- `ai_manga_viewer_get_feature_registry()`：正式Feature IDと初期可用性を返す。
- `ai_manga_viewer_has_feature( $feature_id )`：登録済みIDの現在の可用性を返す。未知ID、空文字、非stringは`false`。
- `ai_manga_viewer_get_feature_map()`：Registry全体をboolean mapへ変換する。

正式Feature IDは`panel_reader`、`cta`、`analytics`、`ai_consultation`の4個。Phase 8Bではすべて`true`である。

`ai_manga_viewer_has_feature` filterは、初期可用性とFeature IDを受け取る。licenseやProアドオン判定はまだ接続しない。

## JavaScript

PHPのFeature mapを次のglobalへJSONとして渡す。

```js
window.aiMangaViewerFeatures
```

Direct Viewer Editor、登録済みViewer Editor、Frontendの各スクリプトより前に定義する。JavaScript側ではFeature IDを再定義せず、このmapを参照する。Phase 8Bでは既存UIやランタイムを非表示・停止する条件には使用しない。

## 次Phaseへの境界

Phase 8CではEditor UI、Renderer、コマViewer、CTA、Analytics、AI相談をこのAPIへ接続する。Free機能にはFeature IDを追加しない。Analyticsのcleanupとデータ保持は計測機能から分離する必要があり、AI相談はAnalytics依存を明示的に扱う必要がある。
