# Phase 8C-5: AI Consultation物理分離

## 状態

AI相談資料の管理画面、context組み立て、Markdown生成、コピーUIと管理assetをAI Manga Viewer Proへ物理移動した。CoreはFeature IDと、Featureが有効な場合にManga Libraryから管理画面URLへ誘導する汎用リンクだけを保持する。

## 所有境界

| 所有者 | ファイル | 責務 |
| --- | --- | --- |
| Core | `includes/features.php` | `ai_consultation=false`の既定値と共通判定入口 |
| Core | `ai-manga-viewer.php` | Featureが有効な場合だけManga Libraryに相談リンクを表示 |
| Pro | `includes/modules/ai-consultation/bootstrap.php` | Pro/Analytics依存確認とFeature有効化 |
| Pro | `includes/modules/ai-consultation/consultation.php` | menu、入力検証、context、Markdown、画面描画 |
| Pro | `assets/ai-consultation/admin.css` / `admin.js` | 相談画面とコピー操作 |

## 読み込み順と依存

Pro bootstrapはAnalytics moduleを先に、AI Consultation moduleを後に読み込む。AI相談は`analytics=true`で、`ai_manga_viewer_analytics_report_days()`と`ai_manga_viewer_analytics_context()`が存在する場合だけbootする。依存方向はPro AI ConsultationからPro Analyticsであり、CoreからPro private実装を呼び出さない。

## 挙動

- Coreのみ: AI相談menu、Libraryボタン、生成画面、生成関数、assetは存在しない。
- Core + Pro: Analyticsが利用可能な場合にAI相談を有効化し、従来のVersion 2 Markdownを生成する。
- Analytics設定OFF: menuと通常導線は隠すが、保持済みデータを参照する既存の直接URL動作は維持する。
- 外部AIへの自動送信は行わず、認証情報・query付きURL・localhost・private IPを資料から除外する。
- DB schema、REST、event、保存期間、既存データは変更しない。

## 配布境界

Core ZIPから`includes/consultation.php`、`includes/analytics/provider.php`、`assets/admin-consultation.*`を除外する。Pro ZIPだけが`includes/modules/ai-consultation/`と`assets/ai-consultation/`を収録する。Core/ProのVersionは変更しない。

## 検査

Core-only Feature/menu/asset不在、Pro bootstrap順序、Markdown Version 2、入力allowlist、URL安全性、データ0件、Analytics OFFの保持データ、権限拒否、コピーUI、両release ZIPの完全許可リストを検査対象とする。
