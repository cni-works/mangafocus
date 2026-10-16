# 設定画面再構成 Phase 2

Phase 1の独立モードと公開側エンジンを維持して、編集UIと同梱翻訳を更新する。
基準HEADは9f26de203c3e6a7a1909fbba195b0de7a0270809、ブランチはfeature/free-reading-modes-ui-next。
Phase 1検証ZIPとの元コードハッシュ一致を確認。実サイトのインストール済みファイルは直接確認していない。
WordPress実機、ZIP生成、commit、バージョン変更、Pro/SDK変更は今回実施しない。

## グループと保存キー

| 配置 | 項目・保存キー | 主な適用範囲 |
|---|---|---|
| ページ画像 | pages、focusAreas、mobileFocusAreas、cta、pageKey | 既存の追加・選択・並替・削除UIを維持 |
| 通常ビュアー | enableInline | Phase 1の判定と保存方式のまま |
| 通常ビュアー | scrollAssist、scrollAssistPosition、scrollAssistStrength | windowスクロールの補助 |
| 全画面モード | enableFullscreen | Phase 1の判定のまま |
| 全画面モード | fullscreenReadingMode、fullscreenStartAtCurrent、spreadReadingMode | 全画面の読み方、開始位置、見開きの読み方 |
| コマ読みモード | focusReader | Phase 1の全OFF/設定不足制限を維持 |
| コマ読みモード | mobileFocusReader、focusReaderStartAtCurrent、pages[].focusAreas/mobileFocusAreas | 従来のコマ編集・開始位置 |
| 全体設定 | pageLayout、singleFirstPage | 通常・全画面のページ送り。縦読み・コマ読みのレイアウトは別 |
| 全体設定 | binding | 通常・全画面のページ送りとコマ読みの送り方向。縦読みは上から下 |
| 全体設定 | maxWidth | 通常表示の最大幅、全画面縦読みの基準幅 |
| 全体設定 | showPageNumbers | 通常・全画面。コマ読みのカウンターは独立 |
| 全体設定 | enableEdgeClick、showGuideArrowOnAllPages | 通常・全画面のページ送り。コマ読みは独立した操作 |
| 全体設定 | enableAnimation | 単ページのページ送り。見開き・縦読みのページめくりは対象外 |
| 全体設定 | enableZoom、zoomControlsPosition | 通常・全画面。コマ読みのarea.zoomは独立 |

登録ライブラリの案内とProの追加パネルは上記基本5グループとは別に維持する。
各モードのスイッチをPanelBodyの先頭へ配置。OFFは詳細のReact要素を非表示にするだけで属性を更新しない。
全体設定は初期状態で折りたたむ。通常/全画面/コマ読みはスイッチが確認しやすいよう初期状態で開く。
通常表示のスクロール補助はwindowのスクロール停止後に動くため、説明もそれに合わせた。
現行公開JSのwindow監視にはFullscreenを明示的に除外する条件がない。全画面縦読みは別のrootスクロールを使うが、全画面中のwindowイベントでの副作用は実機未確認。今回はエンジンを変更しない。

## 拡張と互換性

ブロック属性定義、readingModes、setReadingMode、登録/保存/公開側の処理はPhase 1と同一。
コマ編集の詳細だけをCore内部のmangafocus.editor.panelReaderSettingsフックでコマ読みグループへ配置する。
既存の3つの公開編集フック（inspectorPanels/stageOverlays/auxiliary）、Extension API 1、currentPageIndex/currentPage/updateCurrentPageは維持。
旧コンテキスト向けのinspectorPanelsフォールバックは保持。新しいコンテキストでは旧配置を抑制して重複を防ぐ。
StageOverlayの領域作成・移動・リサイズ・削除処理は変更しない。
モードON/OFFはPhase 1どおり3つのフラグだけを更新し、ページ・コマ・CTA・識別キーを変更しない。

## 翻訳

新旧のUIと警告26項目を既存i18n-map.tsvへ追加。既存行は全て保持。
既存build-translations.phpを--convert-sourceなしで実行し、POT/PO/MOと編集スクリプト2カタログを更新。
英語msgidと__('...', 'mangafocus')を使い、JSへ日本語文字列を固定しない。
既存PHP/公開JSなどの翻訳も維持する。ビルダー自体は変更しない。
ローカルの英語/日本語JSON表示とMO内容を検査する。WordPress.orgへのPTE申請・翻訳承認・配信操作は未実施。
公開時は新しい英語ソース/POTの抽出結果を確認し、GlotPressでjaの新規メッセージを翻訳/PTE承認し、言語パック配信後に実機確認する。
PHPの既存loaderは公式MOがあるとそれを優先してreturnする。古い公式MOにないサーバー側の新規エラー文言は英語になる可能性がある。今回の編集UIのJSON翻訳とは別の確認事項。
同梱ハンドル名JSONを指定する既存wp_set_script_translationsの経路を維持。WordPressの実際のカタログ選択・他プラグインによる上書きは実機未確認。

## ページめくり演出の読み取り調査

blocks/viewer/view.jsのchange()はspreadActive時にfinishViewChange()へ直行し、is-turning/is-leavingを付けない。
単ページのときだけこれらのクラスと360msの遷移を使う。style.cssはdata-animation=onとis-turningを条件にページ回転を描画。
同じ分岐は公式0.3.0にも存在する。Phase 1で追加された見開きの不具合とは判定しない。
ただし「ページめくり演出」が全表示構成に適用されるように見えるUIとの不整合はあるため、今回説明を明確化した。

| 構成 | ページめくり演出 |
|---|---|
| 通常・単ページ | ONでページ回転、OFFで即時。reduced-motionではCSSで抑止 |
| 通常・見開き | spreadActiveの経路で回転を省略 |
| 全画面・単ページ | 通常と同じchange()で回転 |
| 全画面・見開き全体 | spreadActiveの経路で回転を省略 |
| 全画面・見開き1ページ拡大 | moveFocusedPage()の経路。別の短いフェードはあるがページ回転ではない |
| 全画面・縦読み | スクロールで移動するためページ回転なし |
| コマ読み | 独立したモーダル。enableAnimationのページ回転とは別 |

spreadActiveは設定値だけでなく実幅によるレイアウト判定。自動/見開き設定でも狭い幅で単ページに戻る場合は単ページ経路になる。
先頭単独表示でもspreadActive自体がtrueならページ回転を省略する。
見開き拡大の別フェードはenableAnimationを参照していない。reduced-motionは抑止する。必要なら別工程で仕様を整理する。
見開きに回転演出を追加するなら中規模の変更を見込む。2ページを1つの遷移面として扱うJS/CSS設計と、アクセシビリティ・クリック・CTA/解析イベントの整合を検証する必要がある。
単にspreadActiveの早期returnを削除すると、単ページ前提の重ね方とページ索引で見開き表示を壊すリスクがある。
RTL/LTR、先頭単独、混在画像、見開き拡大、ズーム、コマ読みへの切替、Pro CTA、解析イベントを回帰対象にする。
演出の実装・修正は今回行わない。

## テストと次の実機確認

inspector-groups-smoke.cjs: 実ソース+要素/フックのモック。5グループ、詳細・値保持、26項目のen/ja、制限、ページ/CTA保持、Pro実ソースの編集コールバック。
inspector-groups-browser-smoke.cjs: Headless EdgeでDOM部品のモックを使い、英語/日本語の開閉・ON/OFF連動を検証。WordPress PanelBody自体のテストではない。
既存のコマ編集、Phase 1モード、i18n、PHP描画、Extension/ブラウザ回帰を再実行する。
React/WordPress components実装はローカル依存にないため、実GutenbergのPanelBody開閉・カタログ選択・保存は次の実機確認で行う。

次の承認後、manual-devだけで、旧漫画を開くだけ→非モード再保存→テスト用漫画の各モードOFF/ON→ja/enの見出しと警告→コマ編集/現在ページ切替→ライブラリ・ショートコードの順に確認する。
Proの実機確認は別途承認された専用環境で行い、保護サイトの認証状態を変更しない。
Phase 1 ZIPは今回更新しないため、このZIPにはPhase 2 UIと翻訳は含まれない。次の検証ZIP生成は別途承認が必要。
