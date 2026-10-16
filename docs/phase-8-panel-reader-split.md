# Phase 8C-7：panel_reader物理分離

更新日: 2026-10-01

## 境界

`panel_reader`は、作者が`pages[].focusAreas`または`pages[].mobileFocusAreas`へ登録したコマを順番に表示するPro機能である。Free Coreの`spread`、`pageFocus`、全画面の「1ページずつ大きく読む」はページレイアウト機能であり、`panel_reader`には含めない。

Phase 8C-7後のCore Feature既定値は`panel_reader`、`cta`、`analytics`、`ai_consultation`のすべてが`false`である。互換性を確認したPro Add-onは4Featureを`true`にする。ライセンスと用途別Capabilityはまだ接続しない。

## Coreに残すもの

- block attributes: `focusReader`、`focusReaderStartAtCurrent`、`mobileFocusReader`
- page schema: `focusAreas`、`mobileFocusAreas`
- 既存の座標、順序、倍率、view値の正規化と非破壊的保持
- 画像差し替え時の既存page data引継ぎ
- Direct ViewerからManga Libraryへの許可属性とpage dataコピー
- Manga Library、Registered Viewer、shortcodeで同じViewer attributesを正本にする処理
- single / spread / auto、pageFocus、fullscreen、vertical、zoom / pan、coverLauncher
- Renderer / Editor / Frontend Extension API

Coreだけで保存した場合も非表示のpanel dataをserialize対象から外さない。ページを明示的に削除した場合だけ、そのページに含まれるpanel dataもページと共に削除される。schema変更とmigrationは行わない。

## Proが所有するもの

`includes/modules/panel-reader/`がFeature登録、asset登録、Renderer拡張を持つ。`assets/panel-reader/editor.js`がInspectorとstage overlay、`frontend.js`が専用Viewer、`style.css`が編集領域とmodalを持つ。

Editorは`aiMangaViewer.editor.inspectorPanels`と`aiMangaViewer.editor.stageOverlays`を使い、Core Edit componentを複製しない。公開contextの`attributes`、`setAttributes`、`currentPageIndex`、`currentPage`、`updateCurrentPage`だけで、PC / mobileの作成、選択、移動、リサイズ、削除、順序変更を行う。

Rendererは次のVersion 1 filterだけを使う。

- `ai_manga_viewer_renderer_root_attributes`
- `ai_manga_viewer_renderer_page_overlay`
- `ai_manga_viewer_renderer_after_content`

CoreだけのHTMLにはコマ起動ボタン、modal、panel marker、panel用data attributeを出さない。Pro有効時だけ保存済み設定からこれらを追加する。

## Frontend契約

Pro runtimeは`window.aiMangaViewer.getInstance(root)`からViewer instanceを取得し、`getCurrentPage()`、`getPageElement()`、`goToPage()`、`isFullscreen()`、`getState()`を利用する。panel中の公開reading modeを示すため、Version 1へoptional method `setExtensionMode(mode, source)`を追加した。空文字で解除し、Coreのprivate stateは公開しない。

新しいCustomEventは追加しない。既存の`amv:viewer-interaction`、`amv:viewer-modechange`、`amv:viewer-viewchange`を使う。instanceはReader rootごとに保持し、同一ページの複数Viewerを混線させない。

## 動作

- `focusReaderStartAtCurrent=false`: 論理的な先頭コマから開始する。
- `true`: 通常Viewerで現在表示中の論理ページを含む最初のコマから開始する。
- mobile個別設定ONでは`mobileFocusAreas`を使い、OFFでは従来どおりPC領域を使う。
- コマのないページはページ全体表示をsequenceへ含める。
- next / previousはページをまたぎ、keyboard、click/tap、swipe/touchを維持する。
- coverLauncherでは全画面起動と専用Viewer起動を別導線として維持する。
- vertical fullscreenはCoreの別モードで、panel readerへ統合しない。
- 通常Viewerのzoom / pan stateをpanel modalへ共有しない。

## 他のPro機能

CTAはCore page overlayに保存済みCTAを描画し、panel modalへ現在ページのoverlayを複製する。Analyticsはpanel操作を`readingMode=panel`の既存interactionとして観測し、read start、page reach、active time、final reachを論理ページ単位で扱う。panel単位eventは追加しない。AI Consultationは保存済み`focusAreas` / `mobileFocusAreas`からコマ数を取得し、Editor private stateへ依存しない。

## 停止と復帰

Pro停止・削除・非互換時は通常Viewerへフォールバックし、panel UIとruntimeを読み込まない。保存データはCore schemaで保持する。Coreで基本設定やページ順を変更して再保存した後も、Proを再有効化すれば同じpageに紐づくPC / mobile領域、開始位置、Feature設定が復帰する。

ライセンス期限切れ時の「公開runtimeは継続、Editorは停止」はPhase 8DでCapability APIとして実装する。Phase 8C-7ではPro readyならEditorとruntimeの両方が有効である。ただし登録処理を別関数に分け、後から個別Capabilityを適用できる構造にする。

## 配布契約

Core ZIPにはpanel editor、modal runtime、panel JS/CSS、panel公開markupを含めない。互換schemaとFree pageFocusは含める。Pro ZIPにはpanel-readerのPHP、editor JS、frontend JS、CSSを含め、tests、docs、scripts、source mapは含めない。

## 実機確認が必要な項目

自動検査は構文、Feature、保存互換、Renderer、Editor extension、browser、Analytics/CTA/相談、release allowlistを対象とする。WordPress実機ではCoreのみの再保存、Pro再有効化、PC/mobile領域編集、startAtCurrent、ページ跨ぎ、fullscreen、CTA、Analytics、AI Consultation、PHP logとconsoleを確認する。
