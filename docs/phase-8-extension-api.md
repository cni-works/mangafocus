# Phase 8C-2：Extension API契約

## 目的

Free Coreと将来のPro Add-onを物理分割するとき、保存済みブロックやViewerの内部実装へPro側が直接依存しないための最小契約を定める。Phase 8C-2では既存機能を移動せず、全featureを利用可能なまま拡張口だけを追加する。

Extension API VersionはプラグインVersionと別管理とし、現在は整数`1`である。PHPでは`AI_MANGA_VIEWER_EXTENSION_API_VERSION`と`ai_manga_viewer_get_extension_api_version()`、ブラウザーでは`window.aiMangaViewer.extensionApiVersion`から確認できる。互換性を壊す契約変更時だけmajor値を更新する。

## 公開契約

### Gutenberg editor filters

`wp.hooks`のfilterを使用する。初期値は空配列で、返り値が配列でない場合は無視される。

| filter | 配置 | 用途 |
|---|---|---|
| `aiMangaViewer.editor.inspectorPanels` | `InspectorControls`末尾 | 設定パネル |
| `aiMangaViewer.editor.stageOverlays` | 現在ページの編集stage内 | ページ上の編集補助表示 |
| `aiMangaViewer.editor.auxiliary` | ブロック編集UI末尾 | 補助UI |

各filterには`[]`とcontextを渡す。contextは`apiVersion`、`clientId`、`attributes`、`setAttributes`、`currentPageIndex`、`currentPage`、`updateCurrentPage`を持つ。拡張は既存配列へReact elementを追加して返す。Coreの非公開関数、DOM class、React stateへは依存しない。

### PHP renderer filters

| filter | 初期値 | 引数 | 契約 |
|---|---|---|---|
| `ai_manga_viewer_renderer_root_attributes` | `array()` | attributes, context | `data-amv-*`属性だけ追加可能。Coreが値をescapeする |
| `ai_manga_viewer_renderer_page_overlay` | `''` | markup, page, page index, context | 各page canvasのCore content後へ挿入 |
| `ai_manga_viewer_renderer_after_content` | `''` | markup, context | Reader root末尾へ挿入 |

page overlayとafter-contentの提供側は、自身のHTMLをsanitize・escapeする。コールバックがなければ空のwrapperを出力せず、従来DOMを維持する。

renderer contextは`api_version`、`viewer_key`、`instance_key`、`page_count`、`pages`と、表示設定の一部をまとめた`settings`を持つ。これは拡張描画用の読み取り値であり、保存schemaではない。

### Frontend Viewer API

`window.aiMangaViewer.getInstance(target)`で取得する。`target`はReader root elementまたは`instanceKey`文字列。該当なしは`null`を返す。同一ページの複数Viewerはrootごとの独立instanceとなる。

公開method：

- `getRootElement()`
- `getIdentity()` → `{ viewerKey, instanceKey }`
- `getCurrentPage()` → `{ index, key }`。`index`は0始まり
- `getVisiblePages()` → page情報の配列
- `getPageElement(index)` → 指定indexのpage element。範囲外は`null`
- `getState()` → identity、currentPage、visiblePages、layout、spreadMode、readingMode、fullscreenのcopy
- `goToPage(index)` → 成否boolean
- `setExtensionMode(mode, source)` → Add-onが公開reading modeを設定する。空文字で解除し、成否booleanを返す
- `isFullscreen()`
- `openFullscreen()` / `closeFullscreen()` → 操作受付の成否boolean

内部state object、Analytics session、匿名ID、DOM実装詳細は公開しない。返り値は必要な読み取り情報だけを毎回組み立てる。

`setExtensionMode()`はPhase 8C-7でpanel readerが`readingMode=panel`を既存イベントとAnalyticsへ通知するために追加したoptional contractである。Coreのnavigationやfullscreen stateを書き換える入口ではない。

### Frontend CustomEvents

イベントはReader rootからbubbleする。全detailに`apiVersion`と`identity`を含む。

| event | 意味 |
|---|---|
| `amv:viewer-ready` | 公開APIを取得可能になった |
| `amv:viewer-viewchange` | 現在ページ・表示ページ・layout等が変わった |
| `amv:viewer-fullscreenchange` | 全画面状態が変わった |
| `amv:viewer-modechange` | standard / fullscreen / vertical / zoom / panel等が変わった |
| `amv:viewer-interaction` | Reader内でpointer・key・touch・wheel・click操作があった |

追加detailは次の範囲に限定する。

- ready: `state`
- viewchange: `currentPage`、`visiblePages`、`layout`、`spreadMode`、`readingMode`、`source`
- fullscreenchange: `fullscreen`、`readingMode`
- modechange: `readingMode`、`previousMode`、`source`
- interaction: `source`、`action`、`readingMode`、`currentPage`、`visiblePages`。CTAでは`ctaKey`も含む

これらは拡張連携用の一般イベントである。Phase 8C-4BではPro collectorがこの契約からAnalytics eventを生成し、Core自身は`amv:reader-event`やREST送信を生成しない。

instanceはReader初期化時にroot elementをkeyとする`WeakMap`へ登録する。DOMから外れたViewerは`instanceKey`検索対象から外れ、rootへの外部参照がなくなればGC可能である。現在のReaderには明示的な再初期化・破棄処理がないため、Version 1では`destroy()`とdestroy eventを公開しない。

## Feature APIとの役割分担

Feature APIは、保存済み設定を含む機能がその時点で利用可能かを判定する。Extension APIは、別Add-onがCoreへUI・描画・runtime連携を追加する契約である。Extension APIの存在は特定featureの有効化を意味せず、Phase 8C-2では4featureがすべてtrueのままである。

将来のライセンス期限切れでは、同じfeatureでも公開runtimeと編集権、Analytics collectionとreport閲覧権が異なる。Extension API Version 1はその判定を持たず、公開slotとruntime eventを提供するだけとする。Phase 8Dで用途別Capability APIを追加し、Pro Add-onが登録するUI・Renderer・収集・管理画面を個別に制御する。Extension hook内部へlicense判定を散在させない。

## 非公開範囲

次はExtension APIではない。

- CSS class、具体的なDOM階層
- `view.js`内の変数・関数・timing
- Analyticsのsession/visitor/event payload
- block attributeを除く内部集計・管理画面構造
- Manga Library内部のpost metaやquery実装

拡張側は公開filter、公開API、CustomEvent、WordPress標準APIだけを利用する。

## Admin拡張

Phase 8C-2では専用のadmin hookを追加しない。Pro Add-onの画面はWordPress標準`add_submenu_page()`でManga Library配下へ登録できるためである。一般設定画面やプラグイン一覧Action Linkもこの段階では追加しない。

## 保存互換と停止時挙動

block attributes、Direct ViewerからLibraryへコピーする許可属性、REST/DB/イベント形式は変更しない。拡張コールバックを解除すると追加属性・overlay・補助UIだけが消え、保存済みViewerはCore表示へ戻る。Phase 8C-2ではPro gating、license接続、Pro Add-on本体を実装しない。

Extension API Version 1の同一major内では、公開hook名、event名、public method、既存required fieldを削除または意味変更しない。追加はoptional fieldや新しい入口を基本とし、互換性を壊す変更ではExtension API majorを更新する。

## 検査契約

- renderer filterは登録、複数page/context、escape、解除後の無出力を検査する。
- editor filterは3箇所へdummy elementを返し、同じcontext契約で呼ばれることと、未登録時に追加UIを残さないことを検査する。
- Frontend APIは複数Viewerの分離、page移動、全画面、汎用イベント、内部Analytics値の非露出をbrowser smokeで検査する。
- release smokeは`includes/extensions.php`の欠落を失敗として扱う。
