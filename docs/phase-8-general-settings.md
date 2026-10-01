# Phase 8C-8 一般設定画面

`AI Manga Viewer 設定`はCoreが所有する、製品状態と管理導線のための読み取り中心のハブである。Manga Library、新規登録、解析設定への入口、Core / ProのVersion、Free機能とPro Featureの利用状態を表示する。保存する一般設定はまだないため、Settings APIは導入しない。

`解析設定`はAnalyticsの収集、保存期間、データ削除を扱う独立画面として維持する。一般設定へ項目を複製しない。

Proは`ai_manga_viewer_pro_status`フィルターで公開状態を提供し、CoreはFeature APIで`panel_reader`、`cta`、`analytics`、`ai_consultation`の利用可否を確認する。CoreからProのprivate functionは呼ばない。Proだけが有効な場合はsafe-disabledを維持し、存在しないCore設定画面へのリンクを出さない。

CoreとProのプラグイン一覧の「設定」は同じCore画面を開く。正式なWebマニュアル、サポート、公式サイトのURLが未確定のため、推測した外部リンクは表示しない。

画面末尾の`ai_manga_viewer_settings_sections` actionは、Phase 8DでCapability、License、Updaterの状態表示を追加できる拡張位置とする。今回はライセンス入力、更新確認、販売導線を実装しない。
