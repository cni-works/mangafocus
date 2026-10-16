# Phase 8D-1 Capability API

Feature APIはモジュールが存在して現在のCoreから利用可能かを示す。Capability APIは、そのFeature内の個別操作が現在許可されているかを示す。両者は別のpublic contractとして維持する。

Coreは`ai_manga_viewer_get_capability_registry()`、`ai_manga_viewer_get_capability_map()`、`ai_manga_viewer_has_capability()`を所有する。正式schemaは`panel_reader.runtime/editor`、`cta.runtime/editor`、`analytics.collection/report`、`ai_consultation.admin`で、Core単体の既定値はすべて`false`である。未知ID、空文字、非string、Feature無効時は必ず`false`になる。

互換性確認済みProは`ai_manga_viewer_capability_map`のpriority 10でbaselineを提供する。将来のライセンス層はより遅いpriorityで`true`を`false`へ制限する。最終的な個別制限には`ai_manga_viewer_has_capability`も利用できる。Capability filterだけでFeature無効を回避することはできない。

PHPがsource of truthであり、Editorとfrontendには`window.aiMangaViewerCapabilities`を渡す。JavaScriptはglobalや該当キーが欠ける場合を`false`として扱う。既存の`window.aiMangaViewerFeatures`も維持する。

Phase 8D-1ではライセンス状態を実装しない。互換Pro ready時は全Capabilityを`true`にし、従来動作を維持する。将来の期限切れでは公開runtimeとAnalytics collectionを維持し、editor、report、AI consultation adminを停止できる。

Analyticsのcollectionはfrontend collector、REST受信、新規保存の境界を制御する。reportは管理画面の閲覧境界だけを制御し、内部集計ライブラリ、既存データ、retention、cleanup、manual deleteは停止しない。AI Consultationはreportとは独立して内部集計を利用できる。

Extension API Version 1は変更しない。Capability APIはその上でPro moduleの動作を制御する追加契約である。
