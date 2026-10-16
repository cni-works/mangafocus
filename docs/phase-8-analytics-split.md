# Phase 8C-4B: Analytics物理分離

## 状態

Phase 8C-4BでAnalyticsの収集・REST・集計・レポートUIをAI Manga Viewer Proへ物理移動した。DB schema、保存、retention、cleanup、設定値と保存済みデータはCoreが所有し続ける。Coreは0.3.0-alpha、Proは0.1.0-alphaのままである。

## 所有境界

| 所有者 | ファイル | 責務 |
| --- | --- | --- |
| Core | `includes/analytics/lifecycle.php` | DB schema、migration、既定設定、cleanup cron、deactivate、uninstall |
| Core | `includes/analytics/storage.php` | 検証済みイベントの保存、重複排除、全データ削除 |
| Core | `includes/analytics/settings.php` | ON/OFF、retention、uninstall、手動削除UI |
| Pro | `includes/modules/analytics/queries.php` | 集計、日別推移、到達、Library catalog、report context |
| Pro | `includes/modules/analytics/rest.php` | config/event REST、payload検証、same-origin、rate limit |
| Pro | `includes/modules/analytics/admin.php` | 解析レポート画面と管理asset |
| Pro | `assets/analytics/frontend.js` | impression、session、reach、CTA、active time、送信と再試行 |
| Pro | `assets/analytics/admin.css` / `admin.js` | レポート表示と操作 |

Coreの`includes/analytics.php`はlifecycle、storage、settingsだけを読み込む。Core単体ではAnalytics REST route、収集JS、query関数、レポート画面を登録しない。Phase 8C-5でAI相談がProへ移ったため、一時provider bridgeも削除した。

## 実行構成

### Coreのみ

- `analytics=false`、`ai_consultation=false`
- Viewer、Manga Library、ショートコード、保存済み作品は通常動作
- Analytics設定、retention、cleanup、手動削除、uninstall policyは利用可能
- 新規収集、REST受付、レポート、AI相談は停止
- 保存済みAnalyticsデータは削除しない

### Core + Pro

ProがCore Extension API Version 1とStorage APIを確認してbootした場合だけ`analytics`を有効にする。Proはrenderer root filterでcollectorをenqueueし、CoreのViewer public APIと汎用CustomEventから従来と同じAnalytics eventを生成する。AI相談はAnalytics moduleの後に読み込み、Pro内部の集計関数へ直接依存する。

## フロント境界

Core ReaderはAnalytics session、visitor ID、event ID、到達重複排除、active timeを保持しない。次だけを公開する。

- `amv:viewer-ready`、`viewchange`、`fullscreenchange`、`modechange`
- `amv:viewer-interaction`の`read` / `cta`情報
- `getCurrentPage()`、`getVisiblePages()`、`getPageElement(index)`等のpublic API
- Library配置を示す`data-analytics-source="library"`

Pro collectorが匿名visitor/session、impression 50%・1秒、vertical reach 50%・700ms、pageKey重複排除、active time、CTA区分を所有する。対象は従来どおりManga Library Viewerだけで、直接配置Viewerは収集しない。

## 維持した契約

- DB table、column、index、schema version
- REST namespace、route、payload、response
- event名とviewerKey / instanceKey / pageKey / ctaKey
- 匿名IDのサーバーHMAC、eventId重複排除
- 30分session再開、保存期間、cleanup、uninstall policy
- 集計意味、レポートUI、AI相談Markdown
- 保存済みblock attributesと既存Analyticsデータ

## 停止・再有効化

Pro停止・削除時はCore Featureがfalseへ戻り、新規収集・REST・レポート・AI相談を登録しない。Core cronは継続し、retentionを適用する。Proを再有効化すると同じCore tablesを参照して収集と表示を再開する。ライセンス期限切れ時の「収集は継続、管理画面は停止」はPhase 8DのCapability APIで分離し、今回の単純Feature APIには組み込まない。

## 検査

- Core lifecycle smoke: schema、既定OFF、cleanup、削除、uninstall
- Core render/feature smoke: Pro route・asset・report不在、Feature false
- Pro bootstrap smoke: Core不在・非互換safe-disabled、互換時だけAnalyticsとAI相談を順番に有効化
- Pro Analytics module smoke: REST、保存、集計、重複排除、匿名化、設定
- browser smoke: Core Viewer + Pro collector、見開き、縦読み、複数Viewer、OFF時停止、管理UI
- Core/Pro release smoke: 各ZIPの完全許可リストと開発ファイル除外
