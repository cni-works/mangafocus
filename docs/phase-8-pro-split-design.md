# Phase 8C-1：Free Core / Pro Add-on 物理分割設計

更新日: 2026-09-30

## 目的と前提

AI Manga Viewerを将来「AI Manga Viewer（Free Core）」と「AI Manga Viewer Pro（Pro Add-on）」の2プラグインへ分ける。分割の目的はコードを別フォルダーへ移すことではなく、Free Coreだけでも既存漫画を安全に表示・再保存でき、Proを再び有効化すると保存済みの高度機能が復帰する構造を作ることである。

Phase 8Aの製品境界とPhase 8BのFeature APIを正本とする。0.3.0-alphaでは4機能を引き続き利用可能とし、この設計段階ではコード移動、Feature gating、ライセンス、更新処理を実装しない。

正式なFeature IDは次の4つとする。

- `panel_reader`
- `cta`
- `analytics`
- `ai_consultation`

## 現在の構造と分割上の問題

| 場所 | 現在の役割 | 分割上の問題 |
| --- | --- | --- |
| `ai-manga-viewer.php` | bootstrap、block登録、Manga Library、登録API、登録済みViewer、shortcode | Core中心だが、Analytics設定の注入、Library出力への解析用属性、解析・AI相談への管理リンクが混在 |
| `blocks/viewer/block.json` | Viewerのattribute schema | `focusReader`系のPro属性も含む。削除するとFreeでの再保存時に既存値を失う危険がある |
| `blocks/viewer/index.js` | Gutenbergの全編集UI | 基本Viewer設定、コマ編集、CTA編集、Library登録が1つのEdit componentに同居し、外部からInspectorやstage overlayを追加できない |
| `blocks/viewer/render.php` | 属性の正規化と全frontend HTML | 基本Reader、コマ用data属性・modal、CTA HTMLが同じ関数に混在 |
| `blocks/viewer/view.js` | Reader全状態と操作 | navigation、spread、fullscreen、vertical、zoomに加え、コマViewer、CTA click、Analytics session・transportが同一closureにある |
| `blocks/viewer/style.css` | editor/frontend共通スタイル | Reader、コマViewer、CTAをselector単位で分ける必要がある |
| `includes/analytics.php` | DB、cron、REST、集計、設定、レポート | Pro停止後も必要なstorage lifecycleとPro機能が同じファイルにある |
| `includes/consultation.php` | AI相談UIとMarkdown生成 | ファイルとしては独立しているがAnalytics関数へ直接依存 |

> Phase 8C-5でこの行の実装はCoreから削除し、Proの`includes/modules/ai-consultation/`へ物理移動した。表は分割開始時の調査記録として残す。

現在はバンドラーや`package.json`を持たず、登録済みのJavaScriptを直接配布している。Phase 8Cで新しい巨大なbuild基盤を同時導入せず、CoreとProがそれぞれ独立したJS/CSSをenqueueする構成を先に成立させる。

## 推奨する最終構成

概念上は次の構成を目標とする。ファイル名は実装時に微調整できるが、責務の境界は維持する。

```text
ai-manga-viewer/
  ai-manga-viewer.php
  includes/
    features.php
    compatibility.php
    library.php
    analytics-storage.php
    admin-settings.php
  blocks/
    viewer/
      block.json
      index.js
      render.php
      view.js
      style.css
    library-viewer/

ai-manga-viewer-pro/
  ai-manga-viewer-pro.php
  includes/
    panel-reader.php
    cta.php
    analytics.php
    consultation.php
  assets/
    editor-pro.js
    frontend-pro.js
    pro.css
    admin-analytics.*
    admin-consultation.*
```

Free CoreをViewer、保存形式、Library、互換処理、拡張契約の正本とする。Pro Add-onはCoreを複製せず、Feature Registryと限定された拡張口を通して機能を追加する。

## Free Coreに残す範囲

- plugin bootstrap、Versionと互換API Version
- Viewer blockとRegistered Viewer blockの登録
- Direct Viewer、Manga Library、Library登録、shortcode
- ページ画像、表紙、`pages`、`viewerKey`、`instanceKey`、`pageKey`
- single / spread / auto、singleFirstPage、overview / pageFocus
- fullscreen、vertical reading、zoom / pan、coverLauncher
- navigation、端クリック、swipe、keyboard、scroll assist、軽量アニメーション
- 共通Rendererと画像・寸法処理
- Feature APIとPro extensionの登録契約
- 保存済みPro属性の互換schema、サニタイズ、非破壊的な引き継ぎ
- AnalyticsのDB lifecycle、retention、cleanup、uninstall safety
- 一般設定のうちデータ保持・削除に必要な入口

`pageFocus`は見開き内のページへ注目するFreeのページレイアウト機能であり、`panel_reader`には含めない。`panel_reader`は作者が登録したコマ範囲を順番に読む専用Viewerを指す。

## Pro Add-onへ移す範囲

### panel_reader

- `focusAreas` / `mobileFocusAreas`の編集UI
- コマ範囲、順序、倍率、表示方式の編集操作
- `focusReader`、開始位置、モバイル用コマ設定のInspector UI
- コマ読みmodalとコマsequence
- コマ送り、スマート追加ズーム、コマ用gesture
- コマViewer固有CSS

### cta

- CTA編集Inspectorとstage overlay
- CTAのサニタイズ済みfrontend markup
- 自由配置、文字・画像、色、演出、hover
- CTA clickを示す意味的イベント
- CTA固有CSS

### analytics

- 新規イベント収集のON/OFF
- frontend session、匿名visitor、active time、event transport
- REST config / recording routeと入力検証
- 集計、レポート、管理画面、管理画面用JS/CSS
- CTA集計、Viewer impression、読書進行

### ai_consultation

- AI相談管理画面
- consultation context組み立て
- Markdown生成とコピーUI
- 管理画面用JS/CSS

Phase 8C-5で上記一式をProへ移動した。AI相談bootstrapは先に読み込まれたPro AnalyticsのFeatureと集計関数を確認し、依存が成立した場合だけ`ai_consultation`を有効化する。Coreにprovider bridgeや生成処理は残さない。

## 共通基盤と最小限の拡張口

WordPress hookを細分化しすぎず、次の契約に限定する。

1. **Feature Registry filter**
   - Coreのregistryを1回構築した後にProがavailableを登録する。
   - 各機能はProプラグイン名、ライセンス、class存在を直接見ず、`ai_manga_viewer_has_feature()`だけを見る。
   - Phase 8Cの切替時にCore既定値を機能単位で`false`へ変更し、対応するPro実装が読み込まれた場合だけ`true`にする。

2. **PHP Renderer extension**
   - 正規化済みページへ拡張データを加えるfilter。
   - page canvas内のoverlayを返すfilter（CTA用）。
   - Reader本体の後へ補助UIを加えるfilter（コマmodal用）。
   - rootのdata属性またはfrontend configを加えるfilter。
   - callback出力はCore側で許可するのではなく、各拡張が生成時に必ずescapeする。

3. **Editor extension registry**
   - Core Edit componentが`context`を作り、Inspector panel、stage overlay、page badgeを追加できる小さなregistryを持つ。
   - Proの`editor-pro.js`が`wp.hooks.addFilter()`等で追加する。
   - `context`には必要最小限の`attributes`、`setAttributes`、現在ページ、page更新helperを渡す。Core内部state全体は公開しない。

4. **Frontend instance APIと意味的イベント**
   - CoreはViewerごとにinstanceを作り、`getCurrentPage()`、`goToPage()`、`getVisiblePages()`、`isFullscreen()`等の安定した最小APIを公開する。
   - `ready`、表示ページ変更、mode変更、fullscreen変更、破棄をCustomEventで通知する。
   - ProはCore closureの変数やDOMの偶然の階層へ直接依存しない。
   - AnalyticsはCoreの中でsessionを管理せず、Pro側adapterが意味的イベントを解析イベントへ変換する。

5. **Admin / enqueue extension**
   - CoreのManga Library submenuを親としてProがAnalyticsとAI相談を追加する。
   - CoreはFeatureごとのPro assetを知識として持たない。Proが自分の画面とfrontend/editor assetをenqueueする。

## block attributesと保存互換

### 採用方針

既存attributeをPro専用metaへ移行せず、互換schemaをCoreへ残す。

- Coreの`block.json`に`focusReader`、`focusReaderStartAtCurrent`、`mobileFocusReader`を残す。
- `pages`内の`focusAreas`、`mobileFocusAreas`、`cta`もCoreの互換データとして認識し、保存・Library登録時にサニタイズして保持する。
- Free EditorではPro UIを表示しないが、既存値を`false`や空配列へ書き換えない。
- ページ順変更はページオブジェクト全体を移動し、Proデータをページと一緒に保持する。
- 画像差し替え時も同じ論理ページのProデータを保持する。明示的なページ削除時だけ、そのページに属するProデータも削除する。
- Direct ViewerからLibraryへ登録・再登録するCoreのallowlistにも互換フィールドを残す。

現在の`pageFromMedia()`は既存コマとCTAを意識して引き継ぎ、Library用サニタイザーも同データを許可している。この性質を分離時に失わない回帰テストが必要である。

将来新しいPro属性を追加する場合は、Proだけで定義してからCoreが知らない状態を作らず、先にCoreの互換schemaを追加する。FreeとProのVersion差で未知属性が消えることを防ぐため、Coreの互換API VersionをProの起動条件に含める。

## `index.js`の分割方針

Coreへ残すもの：block登録、画像選択、ページ追加・削除・並べ替え、Library登録、基本Reader設定、single/spread/auto、fullscreen/vertical/zoom/coverLauncherのプレビュー。

Proへ移すもの：コマ編集stateとpointer操作、コマInspector、CTA helper・Inspector・stage overlay、コマ/CTA badges。

先に現在の巨大なEdit componentをCore部分とextension slotへ整理する。Pro用コードを単純に切り取る前に、既存機能を同じCore内extensionとして動かし、挙動が変わらないことを確認する。その後、そのextensionだけをPro assetへ移す。Free用とPro用のEdit componentを2本作らない。

## `view.js`の分割方針

Coreへ残すもの：表示面、navigation、spread/auto、pageFocus、fullscreen、vertical、zoom/pan、swipe、keyboard、scroll assist、アクセシビリティ、複数Viewerのinstance分離。

Proへ移すもの：コマsequence/modal/スマートズーム、CTA click通知、Analyticsのvisitor/session/active time/transport。

CTAのリンク自体はPro RendererがHTMLを追加する。CoreはCTA selectorを前提としたpointer除外やclick処理を持たず、Pro extensionが必要なイベント制御を登録する。Analyticsが必要とする表示変更はCoreの意味的イベントから取得する。

## `render.php`の分割方針

Core Rendererは画像と基本Readerの安全なHTMLを必ず返す。Pro属性が存在してもFeatureが利用不可なら無視し、通常Viewerとして表示する。

- `ai_manga_viewer_pages()`は画像・pageKeyと互換用拡張データのサニタイズを分離する。
- CTA HTML生成はPro callbackへ移す。
- コマ用data属性とmodal HTMLはPro callbackへ移す。
- `focusReader`が保存済みでも`panel_reader=false`なら通常ページViewerを返す。
- CTA保存値があっても`cta=false`なら何も出力しない。
- Analytics用の`data-analytics-source`は中立なLibrary source情報へ置き換え、Pro adapterが利用する。移行期間は旧属性を残して互換テストを通す。

## CSS分割

Core `style.css`にはReader surface、ページ、navigation、spread、pageFocus、fullscreen、vertical、zoom、coverLauncher、reduced-motionを残す。

コマmodal・focus editor、CTA overlay・CTA animationはPro CSSへ移す。移動はselector群単位で行い、Core CSSとPro CSSの詳細度を不必要に競合させない。Pro CSSが読み込まれないとき、Pro用markup自体も出力されない状態を保証する。

## Admin Menu分割

CoreはManga Libraryと将来の一般設定を持つ。Proは同じ`edit.php?post_type=amv_viewer`配下へ漫画解析とAI相談を追加する。Pro menu callbackは`manage_options`とFeature APIの両方を確認する。CoreはPro画面のslugやcallbackをrequireしない。

現在存在する「解析設定」はイベント収集、保存期間、アンインストール削除だけを扱うAnalytics専用画面であり、プラグイン全体の「設定」リンク先には適さない。

## プラグイン一覧の「設定」リンク

Phase 8C-1では実装しない。

理由は、既存の適切な一般設定画面がないためである。「設定」から解析設定へ移動すると、Free Coreの利用者や解析を使わない利用者に誤った入口を示す。Manga Libraryへ送るならラベルは「漫画ライブラリ」が正確だが、最終希望の「設定｜無効化」とは意味が異なる。

将来、Coreに軽量な一般設定画面を作成した時点で、`plugin_action_links_{plugin_basename}`に「設定」を追加する。リンク先候補は次とする。

```text
edit.php?post_type=amv_viewer&page=ai-manga-viewer-settings
```

一般設定画面は設定を増やすためではなく、次の入口を一か所へまとめる。

- Manga Libraryへの導線
- データ・プライバシー、保存済み解析データの保持・削除
- 有効なFeatureとPro状態の案内
- マニュアル・サポートへの導線
- 将来必要になった場合だけuninstall方針

Proはこの画面へAnalytics等のsectionを追加できるが、Core画面自体はProなしで表示できるようにする。

## Analyticsの分割

現在の`includes/analytics.php`を責務で分ける。

### Coreに残すlifecycle

- table名とschema Version
- schema作成・upgrade API
- retention値のサニタイズ
- daily cleanup callbackとschedule管理
- 全データ削除API
- uninstall時の保持・削除
- 過去データが存在する場合のcleanup継続

### Proへ移す機能

- collection enabled判定
- REST config / event受信
- event正規化、rate limit、保存入口
- frontend transport
- 集計、日別・到達・CTA metrics
- Analytics画面とasset

最初の分割では既存DBを移行・renameしない。Coreにstorage lifecycleを残す。ライセンス期限切れでもProコードが有効かつAnalytics設定がONなら、frontend transport、REST route、DB保存を継続し、管理画面の閲覧・集計・レポートだけを停止する。Pro停止・削除時はREST routeとfrontend transportを登録しないため新規計測が止まる。Core cronはどちらの状態でも過去データをretentionに従って整理し続ける。保存データの手動削除はProがなくても一般設定から実行できるようにする。

Freeのみの新規インストールでAnalytics tableを最初から作るかは未解決とする。初回分割では既存挙動を維持してCore activationで作成する方がrollbackしやすい。分割安定後、履歴のない新規FreeサイトだけPro初回有効化まで作成を遅延する最適化を別途判断する。

## AI Consultationの依存

初期分割ではAnalyticsと同じPro Add-on内の内部依存として扱う。`ai_consultation`は`analytics`が利用可能で、必要なcontext providerが登録済みの場合だけ有効にする。

現在の直接関数依存をただちに大規模なprovider architectureへ変えない。Analytics context取得を1つのPro内部serviceまたはfilterへ集約し、Consultationはその公開されたcontextだけを読む。将来Analytics以外の情報源を追加するときにContext Provider化を再評価する。

## Feature APIとの接続

移行完了後のCore既定値は4機能とも`false`とする。Pro Add-onは互換性確認後にFeature Registry filterで実装済み機能だけを`true`にする。

移行途中で一括して全機能を`false`にしない。1機能ごとに、Pro実装、fallback、自動テスト、実機確認が揃ったcommitでCore実装を外し、そのFeatureの既定値を切り替える。Featureのavailableは「互換性のある実装がロード済み」を表し、ライセンス期限だけでfeature全体を`false`にしない。

期限切れ時は同一feature内でも権利が分かれる。`panel_reader`と`cta`は公開runtimeを許可してEditorを停止し、`analytics`はcollectionを許可してadmin/reportを停止し、`ai_consultation`はadmin利用を停止する。この状態は現在のboolean Feature APIだけでは表現できないため、Phase 8DでFeature APIの上に用途別Capability APIを設ける。各機能へlicense判定を直接書かない。

Pro bootstrapは次を確認し、失敗時はfatalにせず管理者通知だけを出して機能登録を止める。

- Coreが有効
- Core VersionがProの対応範囲内
- Core extension API Versionが一致
- 必要なFeature APIとextension registryが存在

## Pro停止時のfallbackと再有効化

ライセンス期限切れは次のとおり扱う。

| Feature | 期限切れ時の公開・収集 | 期限切れ時の管理・制作 | ライセンス更新時 |
| --- | --- | --- | --- |
| panel_reader | 保存済みコマ読みを継続表示 | 新規作成・既存編集を停止 | 保存済み設定を使って編集UIを復帰 |
| CTA | 保存済みCTAを継続表示 | 新規作成・既存編集を停止 | 保存済みCTAの編集を復帰 |
| Analytics | 設定ONなら送信・REST受付・DB保存を継続 | 閲覧・集計・レポートを停止 | retention内のデータを再表示 |
| AI Consultation | frontend影響なし | 生成・利用を停止 | 保持中のViewerとAnalyticsから再開 |

これはProコードが存在しない次のfallbackとは別契約である。

| Feature | Pro停止時 | Pro再有効化時 |
| --- | --- | --- |
| panel_reader | 通常ページViewerで表示。コマmodalと編集UIを出さない | 保存済みコマ、順序、倍率、開始設定を再読込 |
| CTA | CTAを出力せず、リンクも動作させない | 保存済みCTAを同じページ・位置へ復帰 |
| Analytics | frontend送信とREST受信を停止。過去データ保持とcleanupを継続 | 同じtableから集計を再開。停止期間は0件として扱う |
| AI Consultation | menuと生成UIを非表示。frontend影響なし | 保存済みViewerと保持中Analyticsから再び生成可能 |

Free Editorで基本設定を変更して保存しても、互換schemaと非破壊helperによってProデータを維持する。Pro再有効化時にmigrationを必要としない状態を初期目標とする。

## 推奨するPhase 8C実装順序

### Phase 8C-2：互換契約とextension seam

- 変更：Core/Pro互換API Version、Feature Registry filter、Editor slot、Renderer slot、frontend instance API・意味的イベントを追加する。現行Pro機能は同じCore内からslotを使って動かす。
- 変更しない：ファイルのPro移動、Feature既定値、画面と保存形式。
- 自動テスト：Feature registry、既存block parse/serialize、Free相当再保存、Renderer snapshot、全browser smoke。
- 実機：既存Viewer編集・再保存、複数Viewer、Library/shortcode、全閲覧モード。
- rollback：slot利用前の処理を残した単独commitへ戻せる区切り。

### Phase 8C-3：Pro Add-on骨組み

- 変更：別プラグインbootstrap、Core/API Version確認、管理者通知、Pro独自asset/release/test基盤。
- 変更しない：機能コード移動、Feature既定値、ライセンス、updater。
- 自動テスト：Coreのみ、Core+Pro、Proのみ、読込順、Version不一致、二重登録。
- 実機：プラグイン一覧、有効化/無効化、管理者通知、fatalがないこと。
- rollback：Addonを無効化・削除すれば0.3系Coreだけへ戻る。

### Phase 8C-4：Analytics storageとPro機能の分離

- 変更：lifecycleをCoreへ分離し、収集・REST・集計・画面・transportをProへ移す。
- 変更しない：table、event形式、既存行、retention値。
- 自動テスト：Pro ON/OFFのREST、保存、集計、cron cleanup、uninstall保持、既存データ再表示。期限切れ時にも設定ONなら収集し、レポートだけを閉じる契約をfixture化する。
- 実機：Analytics ON/OFF、シークレットブラウザー、期間、レポート、期限切れ中の新規行継続、Pro停止中の新規行停止、ライセンス更新後の保持期間内データ再表示。
- rollback：table/schemaを変えないため旧`analytics.php`へ処理を戻せる。

### Phase 8C-5：AI Consultation分離

- 変更：Consultation PHP/JS/CSSをProへ移し、Analytics context入口を集約。
- 変更しない：Markdown形式、外部AI連携、保存データ。
- 自動テスト：Feature依存、nonce/capability、Markdown smoke、画像URL安全化。
- 実機：menu、Viewer選択、コピー、Analytics 0件/あり。
- rollback：独立ファイル群をCoreへ戻せる。

### Phase 8C-6：CTA分離

- 変更：Editor panel/overlay、Renderer overlay、frontend click、CSSをProへ移す。
- 変更しない：`pages[].cta`形式と`ctaKey`。
- 自動テスト：Free再保存保持、Pro停止時非表示、復帰、両ページCTA、keyboard、Analytics連携。
- 実機：文字/画像、自由配置、演出、専用Viewer、全画面、Library/shortcode。
- rollback：attribute形式が同じなのでCore extension実装へ戻せる。

### Phase 8C-7：panel_reader分離

- 変更：コマEditor、modal、sequence、スマートズーム、CSSをProへ移す。
- 変更しない：`focusAreas`、`mobileFocusAreas`、`focusReader`系の保存形式。
- 自動テスト：Free再保存保持、通常fallback、PC/スマホコマ、横長コマ、CTA併用、Analytics、reduced-motion。
- 実機：コマ作成・再編集、専用Viewer、開始位置、touch/keyboard、Pro停止・復帰。
- rollback：最後にCore旧実装を外すため、切替直前commitへ機能単位で戻せる。

### Phase 8C-8：一般設定入口と製品表示

- 変更：Core一般設定画面、plugin action link、データ・プライバシー入口、Feature状態表示。
- 変更しない：ライセンス、updater、課金。
- 自動テスト：plugin basename、URL、capability、nonce、Proなし/あり。
- 実機：プラグイン一覧の「設定」、権限別表示、各導線。
- rollback：Action Linkとsubmenuを外すだけでViewerへ影響しない。

### Phase 8D：ライセンス・更新・配布

- license状態を一か所で取得・正規化し、各機能へ直接判定を書かない。
- Feature availabilityとは別に、`runtime`、`editor`、`collection`、`admin/report`等の用途別Capabilityを判定する。
- 期限切れ時も既存コマ読み・CTAの公開runtimeを許可し、新規作成・編集を止める。
- Analytics設定ONでは期限切れ中もtransport、REST受付、保存を許可し、レポートUIと集計閲覧を止める。設定OFFでは収集しない。
- 更新時は期限切れ中の保存済みPro設定とretention内Analyticsを再利用する。
- Pro停止・削除、Core/Pro非互換、通信失敗、猶予期間、時刻ずれをlicense期限切れと区別する。
- updater、更新権、サポート権、管理者通知、キャッシュと再検証間隔を実装する。
- 公開画面へlicense key、状態通知、外部通信エラーを露出しない。

各Phaseは独立commitとし、次のPhaseへ進む前にCoreのみとCore+Proの両方を検査する。

## 最も危険な分割箇所

1. Free Editor再保存で`pages`内のコマ・CTAが欠落すること。
2. `view.js`の内部stateを無理に外部化し、navigation、fullscreen、vertical、zoom、複数Viewerを壊すこと。
3. Analyticsを全てProへ移し、Pro停止中にcleanupと削除手段まで失うこと。
4. Core/ProのVersion不一致で同名関数、二重listener、二重イベント送信が起きること。
5. CTAとpanel readerが同じpage canvas・modalを拡張する順序とfocus/Tab順。
6. Library登録用allowlistからPro互換フィールドを外して登録時にデータを失うこと。

## 必須テスト方針

既存smokeに加え、分割専用のmatrixを持つ。

| 構成 | 必須確認 |
| --- | --- |
| Coreのみ・新規作品 | Free設定だけで作成、表示、Library登録、shortcode |
| Coreのみ・Pro設定済み作品 | fatalなし、通常Viewer fallback、Free再保存後もraw Pro属性保持 |
| Core+Pro | 4Feature復帰、編集値とfrontend表示復帰、既存Analytics表示 |
| Proのみ | fatalなし、管理者通知、機能登録なし |
| 非対応Version | fatalなし、機能登録なし、具体的通知 |
| Pro停止→Core編集→Pro復帰 | コマ、CTA、Analyticsが欠落・重複しない |
| Pro有効・license期限切れ | 既存コマ・CTA表示、編集不可、Analytics ON時の収集継続、レポート不可 |
| license更新 | Pro編集・レポート・AI相談が復帰し、retention内のデータだけを再利用 |

block fixtureには直接配置、Manga Library、Registered Viewer、shortcode、旧Version属性、表紙なし、複数Viewerを含める。PHP/JS構文、render、browser、spread/pageFocus、Analytics、Consultation、release smoke、`git diff --check`を各該当Phaseで実施する。

## 未解決事項

- Free新規インストールでAnalytics tableを事前作成するか。
- Proがない状態の解析データ手動削除を一般設定のどの粒度で提供するか。
- AI Consultationを将来Analyticsなしでも使える資料作成機能にするか。
- Pro Add-onの配布、更新、ライセンス方式。Phase 8Cの物理分割とは別に決定する。
- WordPress.org版と販売版でCore packageを同一に保つ配布工程。
- Capability APIの正式名称と、`runtime`、`editor`、`collection`、`admin/report`の最終粒度。
- license検証不能時の猶予期間、ローカルキャッシュ期間、管理者通知の頻度。
- 期限切れ中の重大なセキュリティ修正をどの更新経路で提供するか。

Extension API Version 1、Editor `wp.hooks`、Frontend WeakMap registryはPhase 8C-2で確定した。残る項目はPhase 8Cの分割検証またはPhase 8Dのライセンス実装前に確定する。
