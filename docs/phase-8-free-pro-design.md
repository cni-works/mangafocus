# Phase 8A：Free / Pro製品設計

## 目的と適用範囲

本書は、AI Manga ViewerをFree本体とProアドオンへ分ける前に、製品境界、状態別の挙動、データ保持、安全なフォールバックを定義する。実装順はPhase 8A（本仕様）→ Phase 8B（Feature API）→ Phase 8C（Free / Proコード分割）→ Phase 8D（ライセンス・更新・配布）とする。

現在の`0.3.0-alpha`には機能制限を導入しない。コマ読み、CTA、Analytics、AI相談を含む既存機能は従来どおり利用できる。Phase 8BでもFeature APIの入口を共通化するだけで、既存featureはすべて利用可能を返す。ライセンス判定、Proアドオン判定、UI制限、Renderer制限は接続しない。

## 製品コンセプト

- **Free：公開・閲覧** — AI漫画をWordPressへ登録・配置し、一般的な端末で快適に読ませるための実用的な基盤。
- **Pro：読ませ方・誘導・分析・改善** — 作者が読み順を設計し、読者の行動を促し、反応を計測して改善へつなげる機能群。

Freeを意図的に不便にしない。Manga Library登録数、1作品のページ数、Viewer設置数には初期の人工的な上限を設けない。上限は保守負荷などの実測上の理由が生じた場合だけ再検討する。

## 機能マトリクス

| 機能群 | Free | Pro | 補足 |
| --- | --- | --- | --- |
| 直接配置AI Manga Viewer | ○ | — | ページ内で作成・表示 |
| Manga Library | ○ | — | 登録数制限なし |
| 登録済みViewerブロック | ○ | — | Libraryの1冊参照 |
| `[ai_manga_viewer]`ショートコード | ○ | — | Libraryの1冊参照 |
| Direct → Library登録 | ○ | — | 作品公開基盤 |
| Library表紙・アイキャッチ | ○ | — | 選択・管理の基礎情報 |
| 通常ページ送り、右綴じ・左綴じ | ○ | — | 基本閲覧 |
| `single` / `spread` / `auto` / `singleFirstPage` | ○ | — | ページレイアウト |
| spread overview / spread pageFocus | ○ | — | pageFocusは全画面の見開き内で論理ページへ注目するFreeの表示方法。コマ読みとは別機能 |
| Fullscreen / 全画面縦スクロール | ○ | — | 基本閲覧 |
| zoom / pan / swipe / keyboard | ○ | — | 読者自身の閲覧補助 |
| coverLauncher | ○ | — | 表紙から閲覧を開始 |
| 軽量なページ切替トランジション | ○ | — | 将来候補の3Dページめくりとは別 |
| コマ読み・専用コマViewer | — | ○ | `focusAreas`を使う作者設計の読ませ方 |
| PC / スマホ別コマ設定 | — | ○ | `focusAreas` / `mobileFocusAreas` |
| CTA作成・自由配置・演出 | — | ○ | 読者の行動を促す機能 |
| CTAクリック計測 | — | ○ | `cta`は表示、`analytics`は計測・集計を担当 |
| Analytics | — | ○ | Viewer impression、read start、page reach、25/50/75/final reach、離脱、CTA分析 |
| AI相談資料 | — | ○ | Analyticsと漫画画像を使う外部送信なしの改善相談資料 |

将来候補のReader Reactions、AI漫画制作設計、公開前チェック、高度なWeb演出、Analytics比較、再制作支援、インタラクティブ漫画、A/Bテスト、PDF、3Dページめくり、Library export / importは本仕様でFree / Proを確約しない。実装前に価値、依存関係、運用費を再評価する。

## Feature ID

Phase 8Bで導入する最初のFeature IDを次の4個に固定する。

| Feature ID | 対象 | 主な依存 |
| --- | --- | --- |
| `panel_reader` | コマ設定、PC / スマホ別コマ設定、専用コマViewer | Freeのpages・通常Renderer |
| `cta` | CTA作成、配置、表示、演出 | Freeのpages・surface・リンク安全化 |
| `analytics` | イベント送信、保存、管理画面、集計、CTA計測 | Manga Library識別子、データライフサイクル |
| `ai_consultation` | AI相談資料の生成・管理画面 | `analytics`とManga Library作品情報 |

コマ読みのIDには`panel_reader`を採用する。`focus_reader`は既存のspread `pageFocus`と意味が近く、製品説明とコードレビューの双方で混同しやすい。`panel_focus`は個々のフォーカス領域、`panel_reading`は動作名に見えるため、機能群を表す`panel_reader`が最も明確である。

初期段階ではCTA表示・位置・演出やAnalyticsの個別イベントを別Feature IDへ細分化しない。異なる販売条件や独立した依存関係が実際に必要になった場合だけ追加する。

## 製品状態別の挙動

| 状態 | Free機能 | 公開済みPro表示 | Pro制作・管理 | Analytics | 更新・サポート | 保存データ |
| --- | --- | --- | --- | --- | --- | --- |
| A. Freeのみ | 利用可能 | Proコードがなければ安全なFree表示へフォールバック | 利用不可 | 新規計測なし。Core lifecycleのみ継続 | Freeの範囲 | 既存値があれば保持 |
| B. Free + Pro有効、license有効 | 利用可能 | 利用可能 | 新規作成・編集・解析・AI相談を利用可能 | 設定ONなら計測、保存、閲覧、集計が可能 | 利用可能 | 利用・更新可能 |
| C. Free + Pro有効、license期限切れ | 利用可能 | 既存コマ読み・既存CTAを継続表示 | Pro設定の新規作成・編集、解析閲覧、AI相談を停止 | 設定ONなら計測・保存・retention・cleanupを継続。閲覧・集計・レポートは停止 | 停止 | 書き換えず保持 |
| D. Proアドオン停止 | 利用可能 | 安全なFree表示へフォールバック | 利用不可 | 新規計測を停止。Core lifecycleは継続 | 停止 | 保持 |
| E. Proアドオン削除 | 利用可能 | 安全なFree表示へフォールバック | 利用不可 | 新規計測を停止。Core lifecycleは継続 | 停止 | 初期値は保持。明示削除時だけ削除 |

ライセンス期限は「公開済みサイトの機能利用期限」ではなく、「Proの制作・分析・改善機能を利用する権利」とする。期限切れでもProコードが存在する限り、公開済み成果物を保護するため既存コマ読みと既存CTAを描画し、保存済み属性を削除しない。一方、コマ・CTAの新規作成と編集、Pro専用編集UI、Analytics閲覧・集計・レポート、AI相談、Pro更新、Proサポートは有効なライセンスを必要とする。公開画面へライセンス警告を表示しない。

期限切れとProコードが存在しない状態は別である。期限切れでは公開用RendererとAnalytics収集コードを動かせるが、Pro停止・削除ではコード自体を利用できないためFree表示へフォールバックし、新規計測を停止する。各機能が`license === active`を直接判定せず、将来のCapability APIを経由する。

### ライセンス有効時

有効なProライセンスでは、既存Pro表示、Pro設定の新規作成・編集、コマ設定、CTA作成・編集、Analytics閲覧・集計・レポート、AI相談、Proアップデート、サポートを利用できる。

### ライセンス期限切れ時の公開と編集

- 通常Viewer、既存コマ読み、既存CTAを継続表示する。
- `focusAreas`、`mobileFocusAreas`、CTA、その他保存済みPro属性を保持し、自動変換・削除しない。
- 新規コマ設定、既存コマ編集、新規CTA作成、既存CTA編集、Pro専用編集UI、AI相談を利用不可にする。
- Freeのページ画像、綴じ、レイアウト、通常Viewer設定は引き続き編集できる。
- Free編集で再保存しても、非表示のPro属性を往復保持する。

## Pro停止時のフォールバック

| Pro機能 | Pro有効時 | Pro停止・削除時 | 保持するデータ |
| --- | --- | --- | --- |
| コマ読み | コマViewer、PC / スマホ別コマ移動 | 通常ページViewerで表示。コマ開始ボタンとPro編集UIは表示しない | `focusAreas`、`mobileFocusAreas`、開始位置等 |
| CTA | ページ上にCTAを表示・操作 | CTAを描画しない。漫画画像、送り操作、ページレイアウトは維持 | CTA種別、URL、座標、色、演出、`ctaKey`等 |
| Analytics | 新規計測、保存、集計画面 | 新規イベント送信・受信とレポートUIを停止 | テーブル、設定、既存履歴 |
| AI相談 | 相談画面・Markdown生成 | 管理画面と生成入口を表示しない | 元となる作品・Analyticsデータ |

フォールバックは保存内容を書き換えない。Pro属性を`false`へ変更したり、CTAやコマ配列を削除したり、Free形式へ移行して上書きしたりしない。再有効化時は保存済みの値をそのまま再利用する。

Free Rendererは、未知または現在利用不能なPro属性が存在しても無視し、通常ページViewerを必ず描画する。`undefined`、PHP fatal、JS例外、空白Viewerを発生させない。ProのHTMLやアセットがない状態を通常ケースとしてテストする。

## データ保持とアンインストール

### 無効化

FreeまたはProの無効化では作品、ブロック属性、投稿meta、オプション、Analyticsテーブルを削除しない。Pro停止は機能の読み込みを止める操作であり、データ削除操作ではない。

### 削除

ProアドオンをWordPress管理画面から削除した場合も、初期設定では作品のPro設定とAnalyticsを保持する。完全削除は管理者が事前に明示した場合だけ実行する。削除設定には対象データを具体的に示し、権限・nonce・確認画面を設ける。将来は「Pro設定を削除」「Analytics履歴を削除」を分けることも検討する。

この方針は、WordPressの無効化hookとuninstall hookを分離し、uninstall時に保存済みの明示設定を確認することで実装できる。データを永続的に残すことにも容量・プライバシー上の負担があるため、管理画面からの手動削除、保持対象の説明、必要ならエクスポート手段を用意する。現在のAnalyticsには「アンインストール時に削除」の明示設定が既にあり、この考え方を分割後も維持する。

## 保存データの所有

作品の正本は引き続きManga Libraryの`amv_viewer`投稿本文にあるViewerブロックattributesとする。直接配置Viewerも同じattributesスキーマを使う。現在はpages内に画像、`focusAreas`、`mobileFocusAreas`、CTA、永続キーがまとまっており、分割時に一括migrationしない。

Phase 8Cの初期段階では、既存Pro属性のスキーマ定義と値の往復保持をFree本体へ残す。Free編集画面がPro属性を理解・編集する必要はないが、投稿を再保存しても値を落とさない必要がある。既存属性をblock.jsonから単純に除去すると、Gutenbergでの再保存時に脱落する危険があるため禁止する。

新規のPro専用管理設定や大きな派生データは、名前空間を持つpost metaまたはPro専用テーブルへ分離できる。ただし、1ページに結び付くコマやCTAのようにViewer描画と一体の設定は、安定したpageKeyを介して作品正本と関連付ける。保存場所を変える場合は、旧値の読み取り、二重書き期間、ロールバック、Pro停止中の往復保持を含む別migration仕様を必要とする。

Free本体がPro設定の意味をすべて解釈する必要はない。Freeの責務は、既知の保存値を壊さず、利用不能な機能を描画せず、基本Viewerへ安全に戻すことである。

## Analyticsの保持方針

- Analytics設定がONでProコードが有効なら、ライセンス期限切れ後もviewer impression、read start、page reach、CTA click等の計測、REST受付、DB保存を継続する。
- 期限切れ中はAnalytics管理画面、集計、レポートを利用不可にする。収集を停止したように見せず、「計測は継続中。閲覧にはライセンス更新が必要」と管理者向けに説明する。
- Analytics設定がOFFなら、ライセンス状態にかかわらず新規計測を行わない。
- Pro停止・削除時は収集コードが存在しないため、新規イベント送信・REST受付・レポート画面を停止する。
- 過去のセッション、到達、イベント、設定はライセンス期限切れだけを理由に一括削除しない。
- retentionとdaily cleanupはライセンス状態にかかわらずCore lifecycleで継続する。保存期間90日に対して期限切れが120日続けば、90日を超えた詳細データは通常どおり削除する。
- ライセンス更新時に復帰するのは、その時点で保存期間内に残っているデータだけである。期限削除済みデータを復元しない。
- Pro再有効化時も既存テーブルと設定を検出し、schema versionを確認して再利用する。

最後の要件がコード分割上の重要点である。Analyticsの全コードをProへ移し、Proを停止・削除すると日次cleanupも止まる。保存期間の約束を守るため、Freeの共通データライフサイクル層にテーブル識別、schema version、期限cleanup、明示削除の最小部分を残す案を第一候補とする。収集、REST、レポート、集計はProが所有する。別案として外部cronへ依存する設計は採用しない。

## ライセンス更新・Pro再有効化時の復帰

ライセンス更新またはPro再有効化時は次の順序で安全に復帰する。

1. Free本体とProアドオンの互換Versionを確認する。
2. 既存作品のPro属性を読み取り、欠損があっても既定値で補う。自動的に作品を書き換えない。
3. Analyticsのテーブルとschema versionを確認し、必要な場合だけ後方互換migrationを行う。
4. Feature APIを通してPro機能を有効化し、編集UI、フロントアセット、管理画面、RESTを登録する。
5. 保存済みコマ、CTA、Analytics、AI相談の入力元を再利用する。

ライセンス更新ではPro編集UI、コマ設定編集、CTA作成・編集、Analytics閲覧、AI相談、更新、サポートを復帰する。期限切れ中に保持されたPro設定と、retention内に残るAnalyticsデータをそのまま使用する。

Proが古すぎる、またはFreeとの互換条件を満たさない場合は、公開側をFree Viewerへフォールバックし、管理者にだけ更新案内を出す。公開側へfatalやライセンス警告を表示しない。

## Feature APIの責務

Phase 8Bで、共通関数`ai_manga_viewer_has_feature( $feature_id )`を導入した。APIの実装仕様は[Phase 8B：Feature API](phase-8-feature-api.md)を参照する。

- 呼び出し側はlicense、アドオンの有無、製品名を判定せず、「機能が現在利用可能か」だけを問い合わせる。
- 未知のFeature IDは安全側の`false`を返す。
- Phase 8Bでは上記4 IDをすべて`true`相当とし、`0.3.0-alpha`の挙動を変えない。
- 将来はFree / Pro構成、アドオン有効状態、互換Version、licenseに伴う権利、filterを内部で評価できる。
- 単一の`ai_manga_viewer_has_feature()`だけでは、期限切れ時の「公開表示は有効、編集は無効」「Analytics収集は有効、レポートは無効」を表現できない。
- Phase 8DではFeature IDを細分化するより、同じfeatureに対する`runtime`、`editor`、`collection`、`admin/report`等のCapability判定を別APIとして設計する。名称と粒度は実装前に確定する。
- 公開Rendererはライセンス期限切れでも既存設定を実行でき、Editorと管理画面だけを制限できる必要がある。Pro停止・互換不成立では安全なFree表示へ戻る防御を持つ。
- Feature APIは課金処理、更新API、データ削除を実行しない。純粋な可用性判定を責務とする。

依存関係として、`ai_consultation`が利用可能でも`analytics`が利用不能なら、現行仕様の完全な相談資料は生成できない。Phase 8Cでは依存featureを一か所で宣言し、矛盾した状態ではAI相談を利用不能として管理者へ理由を表示する。

## 将来のコード分割原則

### Free本体へ残す

- プラグイン起動、ブロック登録、共通Feature API
- pagesの正規化・サニタイズ、画像、綴じ、ページレイアウト
- 通常Renderer、single / spread / auto、fullscreen、vertical、zoom / pan、swipe、keyboard、coverLauncher
- Manga Library CPT、登録済みViewer、ショートコード、Direct → Library登録、表紙
- Viewer / instance / page等の安定識別子
- Pro属性を落とさない保存スキーマと、安全なフォールバック
- Analyticsの保存期間・削除・schema識別に必要な最小データライフサイクル

### Proアドオンへ移す

- コマ編集UI、PC / スマホ別コマ設定、専用コマViewerのランタイム
- CTA編集UI、CTA描画・演出
- Analyticsイベント送信、REST受信、保存、集計、レポートUI
- AI相談画面、相談Markdown生成
- 将来のPro更新・サポート・外部サービス接続

### 共通境界として定義する

- ProがFreeの非公開関数やDOM内部構造へ無制限に依存しないよう、ページ/surface、イベント、管理画面導線、アセット登録に拡張pointを用意する。
- ProはFree本体が有効で互換Versionを満たす場合だけ初期化する。
- Freeを先に更新してもProを先に更新しても、互換範囲内では公開Viewerが動く。
- Pro停止時にFreeがProファイルをrequireしない。
- Freeの公開RendererはProの管理クラスやライセンスSDKを必要としない。

## 現行コードで分割が難しい箇所

1. `blocks/viewer/index.js`にFreeの表示設定、コマ編集、CTA編集が同居している。
2. `blocks/viewer/view.js`に通常閲覧、コマViewer、CTA、Analyticsイベントが同居し、同じページ・surface状態を共有している。
3. `blocks/viewer/render.php`が共通attributesのサニタイズとPro表示情報を一緒に組み立てる。
4. `blocks/viewer/block.json`のpages内部にコマとCTAがあり、Pro属性だけを削ると再保存時のデータ脱落につながる。
5. `ai-manga-viewer.php`がAnalyticsとAI相談を直接`require_once`し、Analyticsのactivation/deactivation/uninstall hookも本体へ直結している。
6. Analyticsの設定注入、REST、管理画面、Library一覧の導線が本体と複数箇所で結合している。
7. AI相談がAnalyticsの期間、集計、Viewer選択関数へ直接依存している。
8. Direct → Library登録の許可属性がFreeとProの設定をまとめて複製するため、分割後も値保持と編集権限を分ける必要がある。

Phase 8Bではこれらを移動せず、判定入口を追加して呼び出し箇所を把握する。Phase 8CでJSのエントリポイント、PHPサービス、管理画面、REST、アセットを段階的に分ける。一度にファイルを移して保存形式まで変更しない。

## Phase 8Bの実装結果

1. 4個のFeature IDを`includes/features.php`のRegistryへ一元化した。
2. `ai_manga_viewer_has_feature()`を追加し、未知ID・空文字・非stringを`false`にした。
3. 4 featureはすべて利用可能とし、現行UI・Renderer・REST・保存挙動を変更していない。
4. `ai_manga_viewer_has_feature` filterを追加し、license処理やPro判定は接続していない。
5. PHPで生成したboolean mapをEditorとFrontendへ`window.aiMangaViewerFeatures`として渡す。
6. Feature API専用smokeと既存render smokeでRegistry、map、Editor、Frontendを検査する。
7. 実際のFeature gatingとFree / Proコード分割はPhase 8Cで行う。

## 未確定事項

- Free / Proそれぞれの正式なプラグインslug、text domain、配布元。
- FreeをWordPress.orgで配布するか、独自更新にするか。
- Proの販売・ライセンス・更新APIを自作するか外部サービスを使うか。
- license期限切れ後のサポート範囲と、重大なセキュリティ修正の提供条件。
- Free / Pro間の互換Version表現、更新順、ロールバック手順。
- Pro完全削除時の設定とAnalyticsを一括または個別に消すUI。
- 将来のReader Reactions、PDF、3Dページめくり等の製品区分。
- Pro設定を将来専用metaへ移す必要性と、その場合のmigration方式。
- Analyticsのデータライフサイクル層をFreeへ残す具体的なファイル/API境界。

これらはPhase 8Aの製品境界を変えず、Phase 8Cまたは8Dで実装前に決定する。
