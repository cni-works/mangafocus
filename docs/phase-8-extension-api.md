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
| `ai_manga_viewer_renderer_page_overlay` | `''` | markup, page, page index, context | 各page canvasのCore content後へ挿入。Coreが固定allowlistで最終sanitizeする |
| `ai_manga_viewer_renderer_after_content` | `''` | markup, context | Reader root末尾へ挿入。Coreが固定allowlistで最終sanitizeする |

page overlayとafter-contentの提供側は、自身の動的な値を用途に応じてescapeする。さらにCoreが出力境界で`wp_kses()`を適用し、コマ読みとCTAに必要な既知の要素・属性だけを許可する。`script`、イベント属性、未知の`data-*`属性などは出力されない。コールバックがなければ空のwrapperを出力せず、従来DOMを維持する。

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

## Runtime API 2 (phase 1, local development)

Extension major remains 1. `window.aiMangaViewer.runtimeApiVersion === 2` and
`runtimeCapabilities` identify optional `lifecycle`, `terminalNavigation`, `modeState`.
No existing method or event is removed. Product version remains 0.5.1 in this local phase.

- `mount(root)` returns the existing or newly initialized instance; invalid markup returns null/undefined. Failed initialization throws after releasing partial resources.
- `destroy(root)` / instance `destroy()` return true once, false thereafter. Await actual `fullscreenchange` before mounting while exiting native fullscreen; preserving fullscreen across replacement belongs to phase 4.
- `getModeState()` returns existing state plus `terminal`; panel mode also supplies sequenceIndex/sequenceCount.
- `registerTerminalHandler(callback)` accepts one handler per instance and returns its disposer (null when occupied). Callback must return literal true synchronously to claim a user request. Exceptions/false preserve Free's default. No license policy is implied.
- `requestTerminal(source)` only claims a verified terminal position and emits `amv:viewer-terminal` after successful handling. It is an imperative user-action entry, never called merely upon reaching the final page. A Pro vertical-end button may call it after explicit user input; Free adds no button.
- `registerModeProvider(mode, getter)` and `onDestroy(cleanup)` return disposers. Add-ons own cleanup of their own resources.
- `amv:viewer-before-destroy` fires before cleanup and `amv:viewer-destroyed` before return; root is restored to its pre-initialization markup. Ready fires once per mount.
- `createResourceScope()` supplies listen/unlisten, timeout, frame, observer, add(cleanup), dispose. Disposal is idempotent. Used internally by the panel module and available to cooperating add-ons.

GET `/ai-manga-viewer/v1/library-viewers/{id}` returns schemaVersion/id/title/coverUrl/html,
not raw block attributes or post metadata. Requires amv_viewer, publish, no password,
and **literal true** from `ai_manga_viewer_library_public_access` (default true after the 2026-11-02 specification change).
The filter may deny access but cannot override type/status/password checks. Existing WordPress
REST authentication/pre-dispatch restrictions remain in effect. No membership-plugin-specific
auto-detection is provided; restricted sites must apply their own REST access controls. Response is no-store.
This public access decision is independent of Pro licensing. No public enumeration is provided.

Old Pro 1.0.0 continues ordinary static rendering/API use. Its analytics collector does not
implement onDestroy: repeated dynamic replacement with the old collector is NOT supported.
Phase 5 must add that cleanup before production use. Phase 1 provides no Pro end screen,
mode inheritance, native fullscreen host, settings schema, new analytics metric or license change.

## Runtime API 2 optional additions for Phase 3 (local development)

- `runtimeCapabilities.mountValidation === true` advertises `canMount(root)`. This is a non-mutating structural preflight for detached markup; it does not promise that later initialization cannot fail. Existing mount/destroy and API major/version remain unchanged. Add-ons must check both capability and method, keep the old work until preparation succeeds, and retain a rollback path.
- The public library GET assigns a fresh `runtime-UUID` instanceKey per response. Source viewerKey/pageKey and saved attributes are unchanged. Runtime placements also use that unique instanceKey in the stage ID / ARIA references. Separate requests for the same work can therefore coexist on one page.
- Public library access now follows publication/type/password rules with an optional denial filter. This does not license Pro, change modes, or integrate old Pro analytics cleanup.
- An installed terminal handler makes the normal reader's final-unit navigation controls available, including when guides otherwise appear only on the first view. With no handler, existing guide/edge settings keep their prior behavior.

- Optional `readerFocus` capability advertises instance `focus()`: focus the Core reading stage without scrolling, return false after destroy / when not readable / in panel mode. Add-ons can return keyboard control after closing their own UI without selecting Core-private DOM.

- `inspectMount(root)` (under the optional `mountValidation` capability) returns null or an immutable `{ identity, firstImageUrl }` preflight snapshot. Pro can validate placement identity and prepare the first page image without reading Core-private selectors or attributes.

- Optional `layoutRefresh` capability advertises instance `refreshLayout()`: synchronously recalculate current visible layout after a caller re-shows the public root. Hidden/destroyed roots return false. Scroll assistance and delayed fullscreen scroll restoration ignore a hidden root so an add-on screen cannot be pulled by the background reader.

## Runtime API 2 optional additions for Phase 4 (local development)

Extension major 1 and Runtime API 2 remain unchanged. Detect both `modeControl` and
`presentationHost` capabilities and the actual methods; an older Free must not start dynamic mode inheritance.

- `getModeState()` adds `presentation`, `availableModes`, `suspended`; existing fields remain.
- `getAvailableModes()` and `requestMode(name)` negotiate normal/fullscreen-paged/fullscreen-vertical/fullscreen-page-focus/focus. The result identifies requested/actual/fallback/fullscreen. Invalid input returns null. No new native Fullscreen request is made by requestMode.
- `setPresentationHost(host)` binds a containing, single-reader host without requesting fullscreen. Core controls use that host for the original user gesture. Destroy exits fullscreen only when the reader root itself owns it; the external host owner manages its final exit/removal.
- `suspendPresentation()`, `resumeFromTerminal(snapshot, {restart, focus})`, and `resumePresentation()` suspend addon-owned presentations, restore the same instance's content, or merely resume its current state. A foreign/malformed snapshot is rejected. No work fetch is required.
- `continueTerminalDefault()` resumes Free's legacy terminal behavior after an addon declines asynchronous authorization.
- `registerModeController('panel', controller)` keeps Focus lifecycle operations in the owning module. Body portals, locks, image handlers, sheets, provider/controller registration and scoped resources are collected on suspension/destruction.
- A terminal handler installs a translated vertical finish button; it becomes usable only at the verified bottom and never opens a screen on scroll alone. No handler means no added button; the original final-next/fullscreen/Focus behavior remains.

Source image probes now release callbacks on destruction and ignore late completions.
This does not change stored attributes, identifiers or published versions. Current public-loading rules are described below.
Analytics integration is still unfinished: Pro's dynamic replacement is blocked while collection is enabled until Phase 5.
## Phase 5 optional integration (local development)

`getModeState().contentVisible` is an optional boolean: a configured reading surface
(including Focus) is visible, rather than only a cover launcher. Hidden/suspended roots
return false. Add-ons should avoid starting reader sessions before content is available.
The major/version and stored block data are unchanged.

Public library GET uses WordPress publication status: amv_viewer + publish + no password.
No global approval, per-work approval or revision stamp is required. Legacy option/meta values
are retained but never read or written by this runtime. After-reading uses its saved destination
IDs; the generic Free REST endpoint remains a public, non-enumerating viewing API.

MangaFocus does not automatically detect membership or third-party access rules. Administrators
are responsible for publishing/linking appropriate works; restricted sites may need separate
REST protection. Existing REST denials and the public-access filter remain usable. The filter
cannot override type/status/password checks. The response is rechecked after rendering;
success/error responses are private/no-store and vary by Cookie/Origin. No private post meta,
editor credentials or license evidence is returned.

The updated Pro collector owns onDestroy cleanup, pause/resume and deferred mount activation.
Older collectors lack that contract and must not perform dynamic replacement while enabled.
No analytics session internals, license data or edit-context settings are added to public responses.