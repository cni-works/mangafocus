# Phase 8C-6：CTA物理分離

## 所有境界

CTAの編集・描画・演出・クリック通知はAI Manga Viewer Proが所有する。CoreのFeature Registryでは`cta`を既定で`false`とし、Proが互換性確認を通過した場合だけFeature API filterで`true`にする。

保存形式`pages[].cta`は既存作品との互換契約であり、Coreが保持する。CoreはCTAの意味を公開機能として提供しないが、ページ正規化、永続キー補完、画像差し替え時の値の往復、Direct ViewerからManga Libraryへの登録・更新で値を失わない。ページを明示的に削除した場合だけ、そのページのCTAも削除される。block schemaとDB migrationは変更しない。

## Proモジュール

Proは`includes/modules/cta/`からFeature公開とRenderer filterを登録し、`assets/cta/`からEditor、frontend、CSSを提供する。

- Inspectorは`aiMangaViewer.editor.inspectorPanels`へ追加する。
- 自由配置previewは`aiMangaViewer.editor.stageOverlays`へ追加する。
- 公開markupは`ai_manga_viewer_renderer_page_overlay`へ追加する。
- 専用コマViewerにはCoreの汎用`data-amv-modal-overlay`複製境界を使う。
- CTA frontendはCoreの公開Instance APIを使い、`amv:viewer-interaction`の`action=cta`を1回だけ発行する。

CTAはAnalyticsへハード依存しない。Analyticsが利用可能な場合だけ、Pro Analyticsが同じ公開interactionを収集し、読書開始前の直接クリックと読書開始後のクリックを従来どおり区別する。AI相談はEditor componentではなく、保存済み`pages[].cta`とPro Analytics contextを参照する。

## 停止と復帰

Pro停止中はCTA UI、公開markup、演出、クリック計測を出さない。Core Viewerは通常どおり表示し、CTA値を保持する。Coreだけでページ追加、並べ替え、画像差し替え、Library登録・更新を行っても既存ページのCTA値を往復保持する。Pro再有効化時はmigrationや再設定なしで、保存済み位置・色・演出・リンクを再利用する。

## Phase 8Dへの引き継ぎ

Phase 8C-6ではCore + Pro readyをruntime/editor双方の利用条件とする。ライセンス期限切れ時に「既存CTAの公開runtimeは有効、CTA editorは無効」を表すため、Phase 8Dでは同じFeatureに対するruntimeとeditor capabilityを分離する。CTA moduleはasset登録、Editor enqueue、Renderer登録を別関数に分け、この分離を妨げない構造を維持する。
