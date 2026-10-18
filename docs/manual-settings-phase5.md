# MangaFocus Free 設定名称・説明文の基準（Phase 5）

対象：Phase 1〜4Dの未公開開発版。正式Version／Stable tagは0.3.0のまま。以下はソースに基づく仕様であり、実WordPressでの合格記録ではない。以後の公式マニュアルで用いる名称の基準。日本語訳は同梱候補訳であり、GlotPress承認済みという意味ではない。

基本呼称：通常表示（Inline display）／全画面表示（Fullscreen display）／フォーカスモード（Focus Mode、コマを順番に拡大表示）。内部API・保存キーは改名しない。

設定グループはページ画像／通常ビュアー／全画面モード／フォーカスモード／全体設定。漫画ライブラリでは表紙画像が最上部。各モードの先頭スイッチと詳細設定は同じパネル内に配置し、OFFでも値を保持。標準アイキャッチは共存しfeatured_media（_thumbnail_id）を共用する。

初期値は新しいブロックの属性値または保存前の編集状態。既存漫画の保存値は優先される。特にenableInlineには属性defaultがなく、旧inlineDisplayMode=readerなら通常表示ON、coverLauncherなら通常表示OFF＋全画面表示ONとして解釈する。開くだけ・非モード編集だけでは新方式へ移行しない。

## 表紙画像

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Select cover image | 表紙画像を選択 | 漫画ライブラリで表紙画像を選択する。 | 未設定（featured_media=0） | 通常表示・全画面表示・フォーカスモード | featured_media → _thumbnail_id | ライブラリの選択中ブロックだけに表示。通常投稿・固定ページのアイキャッチは操作しない。 |
| Change cover image | 表紙画像を変更 | 選択済みの表紙画像を変更する。 | 設定済みの場合に表示 | 通常表示・全画面表示・フォーカスモード | featured_media → _thumbnail_id | 標準アイキャッチと未保存の編集状態も共通。公開／更新で保存。 |
| Remove cover image | 表紙画像を解除 | 表紙の指定を解除する。 | 設定済みの場合に表示 | 通常表示・全画面表示・フォーカスモード | featured_media=0 → _thumbnail_id | 画像ファイルは削除しない。未設定時の1ページ目表示は代替プレビューであり自動保存しない。 |

## ページ画像

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Select page images | ページ画像を選択 | メディアライブラリから漫画のページ画像を選択する。 | 空配列 | 通常表示・全画面表示・フォーカスモード | pages[] | 表紙画像とは別。ページ一覧で編集対象ページを選択する。 |
| Edit page images | ページ画像を編集 | ページ画像を追加・選択し直す。 | 画像選択後に表示 | 通常表示・全画面表示・フォーカスモード | pages[] | 既存メディアと照合できる場合はコマ・pageKey・CTAを保持。画像の削除はページデータに影響するため確認して操作。 |
| Move up | 上へ移動 | 選択した画像を前へ移動する。 | 操作 | 通常表示・全画面表示・フォーカスモード | pages[] の順序 | ドラッグによる並べ替えも可能。先頭は実行不可。 |
| Move down | 下へ移動 | 選択した画像を後ろへ移動する。 | 操作 | 通常表示・全画面表示・フォーカスモード | pages[] の順序 | 末尾は実行不可。 |
| Delete | 削除 | 漫画から対象ページを外す。 | 操作 | 通常表示・全画面表示・フォーカスモード | pages[] | そのページのコマ等も漫画データから外れる。メディアの画像自体を削除する操作ではない。 |

## 通常ビュアー

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Enable inline viewer | 通常ビュアーを有効にする | 投稿・固定ページ内で直接読む通常表示を有効にする。 | ON（enableInline未指定＋readerの場合） | 通常表示 | enableInline | OFFは表紙と有効な起動ボタンへ切替。ページ画像・コマ・設定値は消えない。全OFF禁止。 |
| Automatically adjust scroll position | スクロール位置を自動調整 | 文書スクロールが停止したときに漫画の位置を調整する。 | OFF | 通常表示 | scrollAssist | ページ送りごとの位置合わせではない。全画面中の文書スクロール除外については既知の未検証事項。 |
| Scroll adjustment position | スクロール調整位置 | スクロール停止時に調整する位置を選ぶ。 | 自動（収まるときは中央） | 文書スクロール補助 | scrollAssistPosition | auto／top／center。補助ONのときに表示。 |
| Scroll adjustment strength | スクロール調整強度 | スクロール位置を調整する強さを選ぶ。 | 標準 | 文書スクロール補助 | scrollAssistStrength | gentle／normal／strong。補助ONのときに表示。 |

## 全画面モード

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Enable fullscreen mode | 全画面モードを有効にする | 全画面表示の起動を許可する。 | OFF | 全画面表示 | enableFullscreen | OFFでは全画面起動ボタンを表示しない。 |
| Fullscreen reading mode | 全画面表示の読み方 | 全画面でページ送りと縦読みを選ぶ。 | ページ送り | 全画面表示 | fullscreenReadingMode | paged／vertical。通常表示やフォーカスモードの表示方式とは別。 |
| Start fullscreen from the current page | 現在のページから全画面表示を開始 | 通常表示で開いているページから全画面表示を開始する。 | OFF | 通常表示→全画面表示 | fullscreenStartAtCurrent | 通常表示OFFでは操作不可。表紙の起動ボタンは先頭から開始。 |
| Fullscreen spread reading mode | 全画面表示での見開きの読み方 | 全画面ページ送りの見開きを全体表示または1ページ表示にする。 | 見開き全体 | 全画面ページ送り | spreadReadingMode | overview／pageFocus。縦読みでは非表示。レイアウトがspread／autoの場合に表示。 |

## フォーカスモード

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Enable Focus Mode | フォーカスモードを有効にする | 設定したコマを順番に拡大して読む機能を有効にする。 | OFF | フォーカスモード | focusReader | 単独使用には有効なコマが1つ以上必要。OFFでは起動ボタンを表示しない。 |
| Configure mobile panels separately | スマートフォン用のコマを別に設定 | スマートフォン用のコマ領域と順序を別に指定する。 | OFF | フォーカスモード | mobileFocusReader | スマートフォンでのフォーカスモード有効化スイッチではない。781 CSS px以下で別コマを使用。未設定の配列だけPCから初期コピーし、空配列を含む既存設定は保持。 |
| Panel set to edit | 編集するコマ設定 | PC用とスマートフォン用のどちらを編集するか選ぶ。 | PC | 編集画面 | 保存なし（編集用state） | スマートフォン別設定ONの場合のみ表示。モードやデータを切り替えるスイッチではない。 |
| Add a panel to the current page | 現在のページにコマを追加 | 現在ページの画像上をドラッグしてPC用のコマを追加する。 | コマなし | フォーカスモード | pages[].focusAreas[] | 描いた範囲からx／y／width／heightを決定。idは自動付与される内部識別子。 |
| Add a mobile panel | スマートフォン用のコマを追加 | 現在ページにスマートフォン用コマを追加する。 | コマなし | スマートフォンのフォーカスモード | pages[].mobileFocusAreas[] | 空の配列は有効な保存状態。スマートフォン用コマがないページはページ全体表示となりPC用へフォールバックしない。 |
| Previous | 前へ | 選択したコマを読む順番の前へ移動する。 | 操作 | フォーカスモード | focusAreas[]／mobileFocusAreas[] の順序 | ページ一覧の「前へ移動」と区別する。 |
| Next | 次へ | 選択したコマを読む順番の後ろへ移動する。 | 操作 | フォーカスモード | focusAreas[]／mobileFocusAreas[] の順序 | コマ一覧で操作。 |
| Delete | 削除 | 選択したコマを削除する。 | 操作 | フォーカスモード | focusAreas[]／mobileFocusAreas[] | ページ画像やメディア自体は削除しない。 |
| Display method | 表示方法 | コマの表示方法を選択する。 | 自動（auto） | フォーカスモード | focusAreas[].view／mobileFocusAreas[].view | 自動は幅74%以上かつ高さ68%以上なら全体表示。focusはコマ領域、overviewはページ全体。 |
| Zoom level (%) | ズーム倍率（%） | コマ領域に合わせる倍率を調整する。 | 100% | フォーカスモード | focusAreas[].zoom／mobileFocusAreas[].zoom | UIは60～110%、5刻み。全体表示ではこの値を使わない。通常表示の自由ズームとは別。 |
| X (%) | X座標（%） | コマ中心の横位置を画像に対する割合で調整する。 | 描画範囲により決定 | フォーカスモード | focusAreas[].x／mobileFocusAreas[].x | X／Yは0～100、幅／高さは5～100。コマ選択時に表示。 |
| Y (%) | Y座標（%） | コマ中心の縦位置を画像に対する割合で調整する。 | 描画範囲により決定 | フォーカスモード | focusAreas[].y／mobileFocusAreas[].y | X／Yは0～100、幅／高さは5～100。コマ選択時に表示。 |
| Width (%) | 幅（%） | コマの幅を画像に対する割合で調整する。 | 描画範囲により決定 | フォーカスモード | focusAreas[].width／mobileFocusAreas[].width | X／Yは0～100、幅／高さは5～100。コマ選択時に表示。 |
| Height (%) | 高さ（%） | コマの高さを画像に対する割合で調整する。 | 描画範囲により決定 | フォーカスモード | focusAreas[].height／mobileFocusAreas[].height | X／Yは0～100、幅／高さは5～100。コマ選択時に表示。 |
| When switching to Focus Mode | フォーカスモードへの切り替え時 | 通常ビュアーで途中まで読んでからフォーカスモードに切り替えた際、どのページから読み始めるかを選びます。 | 最初のページから読む（false） | フォーカスモード | focusReaderStartAtCurrent | ラジオ2択。「最初のページから読む」はfalse、「読んでいるページから続ける」はtrue。通常表示・全画面から切替可能。続ける場合も現在ページの先頭コマ。フォーカスモードのみの再開にも適用し、最終ページで閉じると先頭へ戻る。 |

## 全体設定

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Page layout | ページレイアウト | 1ページ・見開き・自動を選択する。 | 1ページ | 通常表示・全画面ページ送り | pageLayout | single／spread／auto。横長画像や対にできないページは単独。縦読み・フォーカスモードは独自レイアウト。 |
| Show the first page separately | 先頭ページを単独表示 | 見開き表示時、先頭ページを1ページだけで表示します。 | ON | 通常表示・全画面ページ送り | singleFirstPage | 2ページ以上かつspread／auto選択時だけ表示。singleでは非表示でも保存値を保持。「表紙画像」とは別の1ページ目の扱い。2ページ構成でも見開き選択後に変更でき、レイアウトの選択時にこの値を自動変更しない。 |
| Binding direction | 綴じ方向 | ページとコマの送り方向を選択する。 | 右綴じ（漫画向け） (rtl) | 通常表示・全画面表示・フォーカスモード | binding | rtl／ltr。縦読みは上から下。 |
| Maximum comic width (px) | 漫画の最大幅（px） | 通常表示の最大幅と全画面縦読みの基準幅を指定する。 | 650px | 通常表示・全画面縦読み | maxWidth | UIは320～1600px、10刻み。画像の実寸や画面サイズでも見た目は変わる。 |
| Show page numbers | ページ番号を表示 | 通常表示・全画面表示のページ番号を表示する。 | ON | 通常表示・全画面表示 | showPageNumbers | フォーカスモードのカウンターは独立。 |
| Navigate by clicking page edges | ページ端クリックで送る | 画像のページ端をクリックしてページを送る。 | ON | 通常表示・全画面ページ送り | enableEdgeClick | 通常表示の案内矢印もこの設定に依存する。 |
| Show navigation arrows on every page | 案内矢印をすべてのページで表示 | 案内矢印を全ページへ表示する。 | OFF（先頭表示のみ） | 通常表示・全画面ページ送り | showGuideArrowOnAllPages | OFFは完全非表示ではない。通常表示では余白または画像下へ配置。ズーム等で案内不可の状態では非表示。全画面の専用操作は別。 |
| Page transition animation | ページ切り替え効果 | なし・ページめくり・フェード・スライドを選ぶ。 | ページめくり（旧ON/OFF継承） | 通常表示・全画面の通常ページ送り | pageTransition | 旧enableAnimationを保持。旧見開きの即時切り替えも継承。フォーカスモード・縦読み・1ページ拡大は既存動作。 |
| Enable free zoom and pan | 自由ズームと移動を有効化 | 通常表示・全画面表示の拡大と移動操作を許可する。 | OFF | 通常表示・全画面表示 | enableZoom | コマの倍率設定とは独立。 |
| Zoom control position | ズームボタンの位置 | ズーム操作UIの位置を下・右・左から選ぶ。 | 下（横並び） (bottom) | 通常表示・全画面表示 | zoomControlsPosition | 自由ズームONの場合に表示。画面幅によりサイド操作UIは表示されない場合がある。 |

## 漫画ライブラリへ登録

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Title | タイトル | 登録する漫画タイトルの初期入力。 | 現在の投稿タイトル、なければ無題の漫画 | 編集画面 | 新規amv_viewerのpost_title | 通常投稿・固定ページの直接ブロックに表示。入力欄は独立した保存属性ではない。 |
| Register in Manga Library | 漫画ライブラリに登録 | 現在の漫画設定を漫画ライブラリへ独立コピーする。 | 操作 | 通常表示・全画面表示・フォーカスモード | 新規amv_viewerのpost_content | ページ画像とタイトルが必要。登録後の直接ブロックと自動同期しない。 |
| Edit registered comic | 登録した漫画を編集 | コピーした漫画を別の編集画面で開く。 | 操作 | 編集画面 | 保存なし（リンク） | 元の直接ブロックと登録先は独立。 |
| Copy shortcode | ショートコードをコピー | 登録済み漫画のショートコードをコピーする。 | 操作 | 編集画面 | 保存なし（クリップボード） | 漫画ライブラリ一覧にもコピー操作がある。クリップボード権限等で失敗する場合は手動コピー。 |
| Replace this block with a Registered Viewer | このブロックを登録済みViewerへ切り替える | 元の直接ブロックを登録済みViewerブロックへ置き換える。 | 操作 | 通常表示・全画面表示・フォーカスモード | ai-manga-viewer/library-viewer: viewerId／instanceKey | 登録先が公開済みで置換が許可された場合のみ。置換前に登録先の内容を確認する。 |

## 登録済みViewer

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Search by title or Viewer ID | タイトルまたは漫画IDで検索 | 登録済み漫画をタイトルまたはIDで検索する。 | 空 | 編集画面 | 保存なし（検索用state） | 候補一覧を絞り込む操作。 |
| Choose again from Manga Library | 漫画ライブラリから選び直す | 別の登録済み漫画を選択する。 | 未選択（viewerId=0） | 通常表示・全画面表示・フォーカスモード | viewerId | Registered Viewerブロックの属性。識別子instanceKeyとは別。 |
| Clear selection | 選択を解除 | 登録済み漫画の選択を解除する。 | 操作 | 通常表示・全画面表示・フォーカスモード | viewerId=0 | 登録済みの漫画そのものは削除しない。 |
| Keep current selection | 選択を変更しない | 選択画面を閉じ現在の漫画を維持する。 | 操作 | 編集画面 | 保存なし（選択UIのstate） | 現在のviewerIdを保持する。 |

## 解析設定（Core管理）

| 英語原文 | 日本語表示 | 説明 | 初期値 | 対象モード | 保存キー | 注意事項 |
|---|---|---|---|---|---|---|
| Enable reader event collection | 読者イベントの収集を有効にする | 漫画ライブラリの解析収集を許可する。 | OFF | Proが収集を許可する状態 | option: ai_manga_viewer_analytics_enabled | Free単体では新規収集しない。OFFにしても既存データは消えない。 |
| Detailed data retention | 詳細データの保存期間 | 詳細解析データの保存日数を指定する。 | 90日 | 解析データ管理 | option: ai_manga_viewer_analytics_retention_days | 30～365日。期限を超えたデータは日次の予約処理で削除する。即時実行の保証ではない。 |
| Delete all analytics tables and settings | 解析テーブルと設定をすべて削除する | アンインストール時の解析テーブル・設定削除を選ぶ。 | OFF | 解析データ管理 | option: ai_manga_viewer_analytics_delete_on_uninstall | 通常の無効化とは別。漫画投稿・画像の削除設定ではない。 |
| Delete all analytics data | 解析データをすべて削除 | 保存済みの解析データを削除する。 | 操作 | 解析データ管理 | イベント・セッション・到達の各テーブルの行 | 取り消せない。テーブルと設定は残る。実行に管理権限とnonce確認が必要。今回この操作は行わない。 |

## 選択肢・操作補足

- ページレイアウト：Single page／Spread／Automatic。全画面の読み方：Paged reading／Vertical scrolling。全画面見開き：Entire spread／Focus on one page at a time。
- コマの表示方法：Automatic (large regions show the full page)／Fit to the panel region／Show full page。領域・倍率を設定してもoverviewはページ全体表示。コマ一覧を選ぶと数値編集が現れる。
- 編集対象コマ：PC／Mobile。これは編集対象の切替であり、スマートフォンでの利用可否スイッチではない。配列未設定と空配列を区別する。空配列はPCへの代替ではなくページ全体表示。
- 通常表示の案内矢印は端クリックON、通常表示中、等倍、先頭表示または全ページ指定などの条件で現れる。通常表示の余白判定が画像外／画像下配置を決める。全画面とフォーカスモードにはそれぞれ専用操作がある。
- スクロール補助の文書スクロール監視には、全画面を明示除外する分岐がない。副作用の実機確認は残課題。文言整備で処理を変更していない。
- 表紙を解除した後の1ページ目プレビューは保存された表紙とは区別して表示。更新／公開はWordPress標準ボタン。保存失敗警告中は保存できたと判断しない。
- 標準の配置／HTMLアンカー／公開状態／投稿タイトル／メディアの代替テキストはWordPressの操作。MangaFocus専用の保存属性を新設しない。Advanced（高度な設定）の表示名はWordPress本体・個人言語設定に依存する。
- 漫画ライブラリの一覧には表紙・ID・状態・ショートコードとコピー操作がある。登録済みViewerの選択候補でも同じ表紙を使用し、未設定なら1ページ目を代替表示する。
- MangaFocus設定のCore／Proバージョン、Pro状態、機能利用可否は表示情報。Pro状態のActiveはプラグイン読み込み状態であり、ライセンスactiveの同義ではない。表示項目に個別の保存スイッチはない。
- 解析設定の全削除・アンインストール時削除は一般の表示モード設定から分離し、マニュアルでも破壊的操作として明示する。

## 一般利用者へ表示しない内部情報

viewerKey／instanceKey／pageKey／コマid／libraryViewerId、Extension API 1、Viewer API、pages[].ctaは互換性のため保持する内部識別・拡張データ。手動編集を案内しない。inlineDisplayModeは旧互換キー。panelReaderSettingsGroupedや編集中の選択stateは一般の設定項目ではない。Proのライセンス証拠・SDK設定・保存ガードはFreeマニュアルの設定一覧へ混ぜない。

## 根拠ソース

blocks/viewer/index.js・block.json、assets/panel-reader/editor.js・frontend.js、blocks/library-viewer/index.js、mangafocus.php、includes/settings.php、includes/analytics/settings.php、includes/analytics/lifecycle.php、includes/panel-reader/renderer.php、blocks/viewer/view.js・style.css。翻訳対応はscripts/i18n-map.tsvとlanguages/。対応する機械可読一覧はmanual-settings-phase5.json。

## 選択肢の対訳

| 英語 | 日本語 |
|---|---|
| Single page | 1ページ |
| Spread | 見開き |
| Automatic | 自動 |
| Right binding (manga) | 右綴じ（漫画向け） |
| Left binding | 左綴じ |
| Paged reading | ページ送り |
| Vertical scrolling | 縦スクロール |
| Entire spread | 見開き全体 |
| Focus on one page at a time | 1ページずつ大きく読む |
| Automatic (center when it fits) | 自動（収まるときは中央） |
| Top of screen | 画面上部 |
| Center of screen | 画面中央 |
| Gentle | 弱い |
| Normal | 標準 |
| Strong | 強い |
| Bottom (horizontal) | 下（横並び） |
| Right (vertical) | 右（縦並び） |
| Left (vertical) | 左（縦並び） |
| PC | PC |
| Mobile | スマートフォン |
| Automatic (large regions show the full page) | 自動（大きな範囲はページ全体を表示） |
| Fit to the panel region | 指定したコマ範囲に合わせる |
| Show full page | ページ全体を表示 |
