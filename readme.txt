=== AI Manga Viewer ===
Contributors: cniworks
Tags: manga, comic, viewer, reader, gutenberg
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Display image-based comics in WordPress with page turns, spreads, fullscreen reading, vertical scrolling, zoom, and reusable Manga Library entries.

== Description ==

= About AI Manga Viewer =

AI Manga Viewer is a WordPress plugin for publishing comics made from image files. It provides page-by-page reading, two-page spreads, fullscreen viewing, vertical scrolling, zoom and pan controls, and reusable Manga Library entries.

The plugin does not generate images and does not send content to an AI API. It can display AI-assisted artwork, conventionally created comics, company introductions, brochures, and other image-based publications.

= Free features =

* A direct AI Manga Viewer block for posts and pages
* Single-page, two-page spread, and responsive automatic layouts
* Optional standalone cover pages and standalone handling for landscape images
* Right-to-left and left-to-right binding
* Fullscreen page navigation and vertical scrolling
* A fullscreen mode that focuses on one page at a time within a spread
* Zoom, pan, keyboard, swipe, and page-edge controls
* A cover launcher that shows only the cover and a reading button in the page
* Reuse through Manga Library, the Registered Viewer block, and shortcodes

The one-page-at-a-time spread mode focuses on each complete page in reading order. It is separate from the panel reader planned for the Pro add-on, which uses author-defined panel regions.

= Creating and reusing comics =

Direct Viewer places an AI Manga Viewer block directly in a post or page and stores the comic configuration with that block.

Manga Library stores a comic as a reusable entry. Select it with the Registered Viewer block or display it with a shortcode:

`[ai_manga_viewer id="123"]`

Registering a Direct Viewer in Manga Library creates an independent copy of its current configuration. Later edits are not synchronized automatically.

= Layout and reading modes =

Choose a single-page, spread, or automatic layout. Spread and automatic layouts can show the first page as a standalone cover and can keep landscape images on their own page.

Fullscreen reading supports normal page navigation or continuous vertical scrolling. Spread-based comics can also focus on one complete page at a time while fullscreen.

= Pro add-on =

The Core plugin can be extended by a compatible Pro add-on. Planned Pro features include an author-defined panel reader, calls to action, analytics reports, and AI consultation material. These features are not included in the Free/Core plugin.

When the Pro add-on is inactive, published content falls back to the regular Free Viewer. Saved Pro settings remain stored so that a compatible add-on can use them again later.

= Data and privacy =

Free/Core does not collect reader events on the public site. It does not send telemetry, use an external analytics service, depend on a CDN, or automatically send content to an external API.

Analytics is disabled by default. If Pro Analytics is used, its data is designed to remain in the local database of the WordPress site. Administrators can configure the retention period and delete stored analytics data.

Core contains the local Analytics table lifecycle, retention schedule, and deletion settings required for compatibility and stored-data management. Without the Pro add-on, no new reader events are collected.

If a site owner uses an image URL hosted on another site, the reader's browser connects to that image host to retrieve the file.

== Installation ==

1. AI Manga Viewerをインストールし、有効化します。
2. 投稿または固定ページで「AI Manga Viewer」ブロックを追加します。
3. 「ページ画像を選択」から漫画画像を読む順に登録します。
4. 1ページ、見開き、自動、綴じ方向、全画面、縦スクロール、ズームなどを設定します。
5. プレビューでPCとスマートフォンの表示を確認して公開します。

同じ漫画を複数の場所で利用する場合は、Direct Viewerの「漫画ライブラリに登録」からManga Libraryへコピーします。その後、投稿へ「登録済みViewer」ブロックを追加して作品を選ぶか、Manga Library一覧のショートコードを使用します。

== Frequently Asked Questions ==

= AI Manga ViewerはAIで漫画を生成しますか？ =

いいえ。漫画画像をWordPress上で読みやすく表示するViewerです。画像生成機能はありません。

= 通常の漫画画像にも使えますか？ =

はい。AIで制作した画像に限らず、通常の漫画、企業紹介漫画、冊子などの画像にも利用できます。

= Direct ViewerとManga Libraryの違いは何ですか？ =

Direct Viewerは投稿や固定ページ内で直接作成します。Manga Libraryは漫画を独立した作品として管理し、登録済みViewerブロックやショートコードから複数箇所で再利用します。

= Direct ViewerをManga Libraryへ登録した後も自動同期しますか？ =

いいえ。登録時に独立したコピーを作成します。登録後はDirect ViewerとManga Library作品を別々に管理します。

= 見開きと「1ページずつ大きく読む」の違いは何ですか？ =

見開きは2ページを同時に表示します。「1ページずつ大きく読む」は、見開きの構造を維持しながら、全画面で片方のページ全体へ順番に注目する表示です。コマ枠を使うProのコマ読みとは異なります。

= Free版だけで使えますか？ =

はい。ページ送り、見開き、自動切替、全画面、縦スクロール、ズーム、Manga Library、登録済みViewer、ショートコードなどをFree/Core単体で利用できます。

= Pro Add-onを無効化すると漫画が表示されなくなりますか？ =

通常のFree Viewerとして表示を継続します。保存済みのPro設定は削除されず、互換性のあるPro Add-onを再び有効化した場合に再利用できます。

= 解析データは外部サービスへ送信されますか？ =

Free/Coreは外部Analyticsサービスへ読者データを送信しません。Pro Analyticsを利用する場合も、データはWordPressサイトのローカルデータベースへ保存する設計です。解析は既定でOFFです。

= アンインストールすると漫画データは消えますか？ =

Manga Library投稿と投稿メタデータは自動削除しません。Analyticsテーブルと設定も既定では保持します。「アンインストール時に削除」を有効にした場合だけAnalyticsテーブルと設定を削除します。定期削除スケジュールはアンインストール時に解除されます。

== Screenshots ==

1. ブロックエディターで漫画ページを設定
2. 通常の1ページ表示
3. 見開き表示
4. 全画面でページ送り
5. 全画面で縦スクロール
6. Manga Library

== Changelog ==

= 0.3.0 =

* Manga Library、登録済みViewerブロック、ショートコードを追加。
* 1ページ、見開き、自動切替、先頭ページ単独表示、横長ページ単独表示を追加。
* 全画面の「1ページずつ大きく読む」表示、縦スクロール、ズーム、表紙から全画面で読む表示を追加。
* Manga Libraryの表紙管理、管理一覧、Direct Viewerからのコピー登録を追加。
* Feature API、Capability API、Extension APIと、Pro設定を保持する互換schemaを追加。
* Analyticsのローカル保存・retention・cleanup基盤を追加。Free/Core単体にはcollectorとreportを含めない構成へ分離。
* WordPress.org申請に向けてfrontend i18n、REST引数定義、readme、再現可能なRelease buildを整備。

= 0.2.0-alpha =

* ページ送り、右綴じ・左綴じ、スワイプ、キー操作を改善。
* 全画面表示、自由ズーム、ピンチ、パンを追加。
* Manga Libraryと登録済みViewerの初期基盤を追加。

= 0.1.0-alpha =

* AI Manga Viewerを独立したWordPressプラグインとして初期化。
