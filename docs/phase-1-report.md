# AI Manga Viewer 第1段階 実装レポート

作業日: 2026-09-25 / 開発版: 0.1.0-alpha / 開発元: CNI

## 実装結果

独立プラグインの基盤をこのプロジェクト直下に作成した。プラグイン単独の登録・描画と、CNI Blocks版とのフロント共存を検証した。WordPress実機での有効化、Gutenbergのメディア操作、保存・再読み込みは未検証であり、以下の手順で最終受け入れ確認が必要。

CNI Blocksの削除・変更、既存投稿の書き換え、本番反映、GitHub操作は行っていない。Free/Pro制限、Analytics、CTA、外部AI、決済・ライセンス、Updaterは追加していない。

## 調査した構成と依存関係

- 元プロジェクト: `../cni_blocks`、ヘッダーVersion 1.43.0、WordPress 6.3以上、PHP 7.4以上、GPLv2 or later。
- `blocks/page-flip/block.json`: API v3、13個の属性、align/anchorサポート。
- `index.js`: WordPressのblocks/element/blockEditor/components/i18nのみを使用。JSX・npmビルドなし。saveはnullの動的ブロック。
- `render.php`: 5個のPHP関数。ページ・コマの正規化、数値範囲の制限、WordPress添付画像とURLフォールバック、HTMLとモーダルの生成。
- `style.css`: ページ・エディター・モーダル、CSS変数、アニメーション、レスポンシブとreduced-motion対応。
- `view.js`: IIFE内で各ブロックの状態を保持。通常操作はroot内、モーダルは自身の要素内を検索する。モーダルだけ開閉時にbodyへ移動し、body classでスクロールを抑止する。
- `cni_blocks.php`: render読み込み、3アセット登録、register_block_typeとCNIカテゴリ登録。共有ライブラリやUpdaterへの漫画機能の依存は見つからなかった。
- リポジトリの作業ファイル全体を関連語で検索した結果、参照先は上記6ファイルのみ。Git内部と配布ZIP内の履歴は検索対象外。元プロジェクトの133ファイルをSHA-256で比較し変更なしを確認。

追加指定の `plugins/cni/_blocks` は存在せず、実在する `plugins/cni_blocks` を確認した。

関連プロジェクト `../../アクセス解析+プラグイン/plugins/access-analytics-plus` も読み取り調査した。Access Analytics Plus 0.5.8-beta / build beta.20260920.2で、最低要件はWordPress 6.8 / PHP 8.1。namespaceはAccessAnalyticsPlus、prefixはAAP_/aap系。漫画関連識別子の直接参照は見つからなかった。trackerは一般的な操作を購読するが、クリック成果判定の対象はa[href]または[data-aap-event]で、新ビューアーのbuttonにこの属性は付けていない。将来の漫画専用計測とは別件として扱う。AAPとの実機同時有効化は未検証。

## 新規ファイル一覧

| ファイル | 内容 |
| --- | --- |
| ai-manga-viewer.php | 独立ヘッダー、アセット・ブロック・カテゴリ登録 |
| readme.txt | 商品説明、要件、導入手順、開発版情報 |
| blocks/viewer/block.json | 新しいブロックメタデータ、既存属性を維持 |
| blocks/viewer/index.js | 移植した編集UI |
| blocks/viewer/render.php | 移植したサーバー描画 |
| blocks/viewer/style.css | 分離したスタイル・アニメーション |
| blocks/viewer/view.js | 分離したフロント処理とTab循環 |
| tests/render-smoke.php | WordPress APIスタブでの登録・描画・共存検査 |
| tests/browser-smoke.cjs | Edge/Playwrightでの表示・操作検査と属性比較 |
| tests/source-sha256.json | 元プロジェクトの変更検出用ハッシュ一覧 |
| docs/phase-1-report.md | 本レポート |

空のincludesや将来用途だけのクラスは作っていない。配布時は本体PHP、readme.txt、blocksだけを`ai-manga-viewer`フォルダに入れる。現在の作業ディレクトリ名は変更していない。

## 独立方法と識別子

現行の5ファイルをコピーし、名前と表示名を置換した。PHP登録部分は漫画機能に必要なものだけを新規作成した。挙動に対する追加は、新モーダル内でTab/Shift+Tabが循環するフォーカス制御のみ。

| 対象 | 旧 | 新 |
| --- | --- | --- |
| ブロック名 | cni-blocks/page-flip | ai-manga-viewer/viewer |
| 表示名 | 漫画ビューアー+ | AI Manga Viewer |
| カテゴリ・textdomain | cni-blocks | ai-manga-viewer |
| PHP描画 | cni_blocks_render_page_flip | ai_manga_viewer_render_viewer |
| PHP補助関数prefix | cni_blocks_page_flip_ | ai_manga_viewer_ |
| アセットhandle | cni-blocks-page-flip-* | ai-manga-viewer-editor / view / style |
| WP wrapper | wp-block-cni-blocks-page-flip | wp-block-ai-manga-viewer-viewer |
| ページ・編集CSS / 変数 / ID | cni-page-flip* | amv-reader* |
| モーダルCSS / body class / keyframes | cni-manga-viewer* | amv-modal* |

JS selector、CSS animation名とその参照も同じ規則で変更。ローカル変数はIIFE・各initのスコープ内であり共有グローバルを追加していない。is-active等の状態classとdata属性はルート内に限定して使用するため保存済みデータを変えず維持した。コマIDは保存データとして扱い、既存focus-*形式を維持する。

## 維持した機能

- 複数画像、メディアライブラリ、ドラッグと上下ボタンの並び替え、表紙・巻末、削除。
- ページ送り、前後ボタン、端クリック、スワイプ、キー操作、左右綴じ、最大幅、ページ番号、演出、ガイド矢印、スクロール位置補助、レスポンシブ。
- コマ読みの有効化、ドラッグ作成、移動・サイズ変更・順番変更・削除、座標と寸法、倍率、auto/focus/overview。
- PC/スマホ別コマ領域、専用モーダル、コマ移動、スワイプ、ページ切替演出、ページ全体表示。
- alt、aria、focus-visible、動きを減らすCSS、閉じた後のフォーカス復帰。

13個の属性定義はJSON比較で一致。pages内部のfocusAreas/mobileFocusAreasを含め、保存構造は変更していない。これらはコード移植としての維持であり、編集UI全操作のWordPress実機合格を意味しない。

## 検査結果と範囲

- PHP 8.3で本体・render.phpの構文検査成功。PHP 7.4での実行は未実施。元コードと同じ7.4対応構文を使用し、新規部分にも8.x専用構文はない。
- Nodeでindex.js/view.jsの構文検査成功。
- APIスタブで単独登録、カテゴリ重複防止、空ページ出力、altエスケープ、旧新PHP同時読み込み、識別子とIDを正規化したHTMLの一致を確認。Warning/Noticeも例外扱いで成功。
- JS登録をVMで実行し、旧新が別名で登録され、JS/JSON/旧JSONの属性定義が一致することを確認。
- 実Edgeのheadless検査で、幅1200/390px、旧新CSSとJSの同時読み込み、独立したページ送り、右綴じキー操作、PC/スマホのコマ数、コマ送り、別モーダルの非連動、Escape、Tab循環、フォーカス復帰を確認。共存検査のpageerrorは0件。
- 新側だけのフロント初期化とTouchEventによるスワイプ検査成功。物理タッチ端末のジェスチャー判定は別途確認する。
- 実行用ソースに旧namespaceの残存なし。CNI Blocksの作業ファイル133件は変更なし。

再実行: `php -l ai-manga-viewer.php`、`php -l blocks/viewer/render.php`、`php tests/render-smoke.php`、`node --check blocks/viewer/index.js`、`node --check blocks/viewer/view.js`。ブラウザー検査はPlaywrightを解決できるNODE_PATHとEdgeが必要で、`node tests/browser-smoke.cjs`を実行する。旧コードとの比較のため隣のcni_blocksを読み取るが、プラグイン本体は参照しない。

## 未解決・実機確認手順

WordPress本体のテスト環境へ直接導入はしていない。APIスタブやフロントHTML検査はWordPress全体の動作保証を代替しない。販売前に以下を検証用サイトで実施する。

1. WordPress 6.3/PHP 7.4と、採用予定の現行環境で単独有効化。インサーターの独立カテゴリ・ブロックを確認。
2. 画像3枚以上を登録し、ドラッグと上下ボタンで並び替え、削除、保存、再読込。順番、alt、表紙/巻末表示を確認。
3. PCコマを作成・移動・拡縮・並び替え・削除し、数値と倍率も変更。スマホ個別設定を有効にし別の領域・順序を保存。再読込後も両方保持されることを確認。
4. 公開画面で右綴じ・左綴じそれぞれの端クリック、ボタン、キー、実端末スワイプ、ガイド矢印、幅、ページ番号、演出、スクロール補助を確認。
5. コマビューのauto/focus/overview、PC/スマホ別設定、ページ切替、末尾で閉じる、Escape、Tab/Shift+Tab、focus-visible、alt読み上げ、フォーカス復帰を確認。
6. CNI Blocksを同時有効化し同じ投稿へ旧新各2個を配置。片方の操作が他方を変えないこと、モーダル開閉後のbodyスクロール、両方のスクロール補助ON時の位置変化を確認。既存の旧投稿も保存せず表示確認する。
7. 利用テーマ、Gutenberg iframe、キャッシュ/遅延読込プラグイン、reduced-motion、実スマートフォンで表示と操作を確認。WP_DEBUG_LOGと開発者コンソールにWarning/Notice/Fatal/エラーがないことを確認。
8. AAP併用時は双方の要件を満たすWordPress 6.8/PHP 8.1以上で検証する。

元実装の操作仕様も維持しているため、通常スワイプとモーダル左右キーの方向は綴じ設定に連動しない箇所がある。仕様統一はユーザー判断を伴う別修正とする。また元のJSの日本語直書き、長い行、モーダルの演出とreduced-motionの細部など、国際化・整形・アクセシビリティの全面監査は完了していない。

## 将来の移行方式

最初は利用者がブロック単位で選択するGutenberg transformを推奨する。新側のfromに旧ブロック名を指定し、createBlockへ既存属性の複製を渡す設計にする。保存時にだけ新ブロックとなり、確認とUndoを行いやすい。13属性のほかalign/anchor/className等のblock supports由来の属性も落とさず、PC/スマホコマと未知のページキーを引き継ぐ試験を行う。これは今回の一致確認からの設計提案で、変換機能自体は未実装。

別の変換ボタンは標準transformとの重複が大きいため後回し。一括移行が必要になった段階で、parse_blocksでツリーを読み、対象blockNameだけを変更してserialize_blocksで戻す方式を検討する。単純な文字列置換は避ける。dry-run、リビジョン/バックアップ、対象投稿ごとの権限・nonce、差分表示、復元、入れ子、同期パターン・テンプレートの参照先を個別に扱い、小さなバッチで実行する。

根拠: [WordPress Block Transforms](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-transforms/)、[parse_blocks](https://developer.wordpress.org/reference/functions/parse_blocks/)。どちらの移行処理もこのα版には含めていない。

## 次の開発候補（未実装）

1. 最優先: 上記のWordPress実機回帰検査、綴じ方向と操作方向の仕様決定、アクセシビリティと入力異常値の追加監査。
2. 次点: 利用者選択式の旧ブロックtransformと復元試験。β検証へ移る前に既存案件を安全に複製移行できるようにする。
3. Phase 2: 通常ページの全画面表示と基本ズーム、次ページ先読み、読書位置保存の順に検討。
4. Phase 3以降: コマ編集体験の改善、演出、CTA、漫画専用Analyticsの順で実案件を通じて評価する。AAPとの連携方式やFree/Pro境界はその時点で決める。
