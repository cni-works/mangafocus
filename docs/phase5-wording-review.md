# Phase 5 文言・翻訳・公開準備の確認記録

## 対象・制約

独立Freeのfeature/free-reading-modes-ui-next、HEAD 9f26de203c3e6a7a1909fbba195b0de7a0270809。文言・翻訳・資料・関連検査のみ。Version／Stable tagは0.3.0、Tested up toは従来の7.1を据え置く。これは次期版を7.1実機で検証したことを意味しない。

## 現行ソースからの再抽出

配布allowlist34件に含まれるPHP／JS／block.jsonとプラグインヘッダーを対象とした。PHPはtoken_get_allでテキストを解析するだけで、WordPressやプラグインをロードしない。JSはコメントと文字列を区別する字句走査を用い、静的gettext引数とドメインを検査。新しいJSの複数形・文脈指定や動的引数が加わった場合は検査で止め、生成方法を再検討する。

抽出結果：英語原文285種類、gettext呼び出し348箇所、block.jsonの対象13箇所（文脈キーは重複をまとめ11件）、プラグインヘッダー2箇所。文脈を区別した現行キー292件。PO／POTのキー334件（ヘッダー除外）のうち42件は互換性のため保持する未参照キー。現行キーの翻訳欠落0、異なるtextdomain0。

過去の追加47件と17件を合算した数字ではない。全件の英語・日本語・context・複数形・現行／旧キー・参照箇所はtranslation-inventory-phase5.csvを正本とする。旧資料の名称はそのPhaseの記録として残し、現在の名称はmanual-settings-phase5.mdを使用する。

## 追加・変更・保持

MOとPhase4D終了時の比較：通常の新規キー14件、WordPressブロックメタデータ用の文脈付きキー11件を追加。既存訳12件を修正し、既存キーの削除は0件。英語原文が重複していたDelete all analytics dataは、すでに実際のMOで採用されていた「解析データをすべて削除」を保持し、辞書の隠れた旧行「解析データの全削除」だけを整理した。生成器に重複英語キーの拒否を追加した。

POTは現行文字列だけでなく旧互換キーを含む。旧キーはCSVでretained_legacyとして明示し、承認済みの訳を削除しない。WordPress.orgへの直接インポート対象をそのまま全件とみなさない。公式側はリリースソースの抽出と文脈に基づいて翻訳を整備する。

### 既存訳の修正

| 英語キー | Phase4D以前 | Phase5候補 |
|---|---|---|
| Add a mobile panel | スマホ用にコマを追加 | スマートフォン用のコマを追加 |
| Configure mobile panels separately | スマホ用のコマ設定を個別指定 | スマートフォン用のコマを別に設定 |
| Enlarge panels in sequence with Panel-by-Panel reading | Panel-by-Panelでコマを順番に大きく表示 | コマ読みでコマを順番に拡大表示 |
| Fullscreen reading mode | 全画面の読み方 | 全画面表示の読み方 |
| Fullscreen spread reading mode | 全画面での見開きの読み方 | 全画面表示での見開きの読み方 |
| Mobile | スマホ | スマートフォン |
| Paged reading, spreads, page focus, fullscreen, vertical reading, zoom, Panel-by-Panel, Manga Library | ページ送り、見開き、pageFocus、全画面、縦読み、ズーム、コマ読み、Manga Library | ページ送り、見開き、全画面での1ページ表示、縦読み、ズーム、コマ読み、漫画ライブラリ |
| Panel-by-Panel viewer | コマ読みビューアー | コマ読み画面 |
| Read by panel | 専用ビューアーで読む | コマ読みを開始 |
| Remove cover image | 表紙画像を削除 | 表紙画像を解除 |
| Search by title or Viewer ID | タイトルまたはViewer IDで検索 | タイトルまたは漫画IDで検索 |
| Start fullscreen from the current page | 現在のページから全画面を開始 | 現在のページから全画面表示を開始 |

### 新規の通常キー

| 英語 | 日本語 |
|---|---|
| On: read within the post or page. Off: show a cover with buttons for the other enabled modes. Page images and panel settings are kept. | ON：投稿・固定ページ内で漫画を表示します。OFF：表紙と、有効な他のモードの起動ボタンを表示します。ページ画像やコマ設定は保持されます。 |
| In inline display, arrows use available side space or move below the image without reducing its width. | 通常表示では、画像幅を縮めずに、配置できる余白または画像下に案内矢印を表示します。 |
| On smartphones, pages without mobile panels are shown as full pages. Desktop panels are not used as a fallback. | スマートフォンでは、スマートフォン用コマがないページはページ全体を表示します。PC用コマへの自動切り替えは行いません。 |
| X (%) | X座標（%） |
| Y (%) | Y座標（%） |
| Viewer ID: | 漫画ID： |
| MangaFocus – Panel-by-Panel Manga Reader | MangaFocus – コマ読み対応漫画ビューアー |
| A manga reader for WordPress with page, spread, vertical, zoom, and panel-by-panel reading. | WordPressでページ送り・見開き・縦読み・ズーム・コマ読みを利用できる漫画ビューアーです。 |
| CTA | CTA |
| Free Viewer | Free Viewer |
| MangaFocus | MangaFocus |
| PC | PC |
| — | — |
| Panel reading also uses this setting when moving between pages. | コマ読みで別のページへ移動するときの演出にも、この設定を使用します。 |

追加のMangaFocus／Free Viewer／CTA／PC／—は、固有表記・記号として同一文字列の訳を明示したもの。機械翻訳漏れとして放置したものではない。ブロックメタデータではblock title／block description／block keywordのWordPress標準コンテキストを使用する。プラグイン内から非公開WordPress関数を呼び出す実装は追加していない。

## 説明文で区別したこと

- 通常表示OFFでもページ画像・コマ設定は保持。
- 全画面OFFとコマ読みOFFは各起動ボタンを表示しない。
- スクロール補助は文書スクロール停止時でありページ送りのたびではない。
- 案内矢印OFFは先頭のみ、ONは全ページ。端クリックON等の条件がある。余白／画像下配置の改善は通常表示に限定して説明し、全画面の処理と混同しない。
- スマートフォン用コマの指定はスマートフォンでのコマ読み有効化ではない。未設定時だけPC領域を初期コピー。空配列は保持され、対象画面幅ではコマのないページを全体表示する。PCへの実行時フォールバックはない。
- ページめくり演出はコマ読みのページ境界でも共通設定を参照することを補足。
- 標準アイキャッチパネルは共存のまま。表紙画像はfeatured_media／_thumbnail_idを共有し、1ページ目の自動保存は復活させない。

## ファイル・生成方法

scripts/i18n-map.tsvからscripts/build-translations.phpでPOT・PO・MO・5ハンドルのJS JSONを生成する。--convert-sourceは使用しない。今回の出力は一時領域で先に生成・差分照合後に反映する。既存の生成ヘッダー日付はツールの固定値であり、編集履歴日時や承認日時の証拠ではない。

languages/mangafocus.pot／mangafocus-ja.po／mangafocus-ja.moと編集用JSON3件（通常ブロック／登録済みViewer／コマ編集）を更新。公開側JSのJSON2件はバイト不変。textdomainとslugはmangafocusのまま。PHP・JSの翻訳読み込み関数は変更しない。

再検査例（実サイトへ接続しない）：

```text
python tests/wording-phase5-smoke.py --php <ローカルPHP実行ファイル>
```

通常実行はリポジトリへ書き込まない。生成器の検査は新しい一時コピー内だけで行う。--write-inventory <出力先>を明示した場合だけCSVを書き出す。実サイト・DB・WordPress本体は起動しない。

## readme・変更履歴

実際のreadme.txtはバイト不変。docs/readme-next-draft.txtは未公開の全面ドラフトで、配布対象ではない。正式VersionとStable tagは0.3.0を保持し、旧Changelogの全文もバイト一致。短文概要133文字、ドラフト9986バイト、既存6スクリーンショットを想定した構造。説明・手順・FAQを新モードと表紙仕様に更新。古いスクリーンショットで新UIが確認できたとは記載しない。

0.4.0候補のChangelogとUpgrade Noticeはchangelog-next-draft.mdへ分離した。番号と公開日・実機試験が確定する前に実readmeへ転記しない。公開物の版番号・Stable tag・対応実績の整合、スクリーンショット差し替え、最終ソースへのリンク確認は公開前の別工程。

## WordPress.org言語パック

PHP：現行ローダーはWP_LANG_DIR/plugins/mangafocus-<locale>.moが存在すればそれをロードして戻り、同梱MOを追加読込みしない。したがって既存の公式言語パックがあるサイトでは、今回修正したRead by panelなどの旧訳が残る可能性がある。候補POの変更だけで実サイト表示が必ず変わるとは断定しない。今回はローダーを変更せず、言語パックの削除や強制上書きも案内しない。

JS：wp_set_script_translationsへlanguagesパスを指定し、ハンドル名付きJSONを収録する。WordPress標準のローダーは指定パスのハンドルJSONを先に試す構成。ただし外部フィルター・翻訳プラグイン・個人言語・キャッシュ等で変わり得るため実機未検証。

ローカルカタログで追加したキーは25件、既存訳の修正は12件。公式GlotPress側のキー存在・承認状況は未照合であり、公式側でもすべて新規／未承認だとは断定しない。今回の候補訳は送信していない。追加した文脈付きキーも別の翻訳対象。ローカルPO／MOに収録済みでも公式承認済みとは扱わない。公開準備時に現行文字列と一致する翻訳提案を行い、公式言語パックと同梱訳の両経路で確認する。今回、送信・承認・配信操作は行わない。

## 配布・公式検査の限界

ビルダーのallowlist34件は変更なし。docs／tests／scriptsは配布物へ入らない。今回のドラフト・マニュアル・抽出CSVもallowlist外で検査する。ZIPを生成して監査したという意味ではない。

WordPress実環境・WP-CLI・Plugin Check・GNU msgfmtは利用できるものを確認できず、新規インストールしていない。独立したPO解析、Python標準gettextによるMO読込み・文脈／複数形参照、JSON検査、readme独自構造検査を実施する。公式オンラインreadme validatorへのアップロードやPlugin Checkの実行合格は主張しない。WordPress.org仕様の確認は公開ドキュメントの読み取りのみ。

## Pro・残課題

Proのブロック名・識別キー・API・保存属性・CTAガード・ライセンス政策は変更しない。Free由来のコマ読み呼称・漫画ID等をProの将来の案内・マニュアルへ合わせる必要がある。Pro自身の翻訳は変更していない。Pro再開地点は「テスト用ProviderとFreemius通信制限の準備」。

実Gutenbergと個人言語、実保存／再読込、旧言語パックがある公開側、実更新・復旧、Proとの実機統合、画面キャプチャは未検証。Phase4Dで保留した標準パネル一本化と、全画面中の文書スクロール補助の除外条件も未解決のまま。名称整理を理由に処理を変更しない。

## 参考（読み取りのみ）

- [WordPress.org readme仕様](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/)
- [国際化ガイド](https://developer.wordpress.org/plugins/internationalization/how-to-internationalize-your-plugin/)
- [ブロックメタデータの文脈](https://github.com/WordPress/wordpress-develop/blob/trunk/src/wp-includes/block-i18n.json)
- [JS翻訳ローダーの公式実装](https://developer.wordpress.org/reference/functions/_load_script_textdomain_from_src/)

## ローカル検証・保護確認の最終結果

- Phase5翻訳・文言テスト、既存i18n、設定ハブ、Feature、Capability、解析ライフサイクル、表紙UI単体／ブラウザ、設定グループ単体／ブラウザ、表示モード編集、コマ編集、Phase4D UI、公開レンダー、旧モード互換の15テストが合格。
- PHP24・JS7・CJS14の計45ファイルと追加Pythonテストの構文が正常。ブラウザはローカルHeadless Edge、管理画面はストア／コンポーネントのダブル。実Gutenbergではない。
- 旧ラベルで停止したコマ編集テストは参照ラベルだけ更新し、描画・移動・サイズ変更・並べ替え・削除・倍率・データ保持の既存検査は維持した。テストのスキップや機能期待値の緩和はない。
- プラグインソース3ファイルについて、承認した文字列差分とgettextラップを逆適用するとPhase4D終了時の元バイト列へ完全一致。公開表示エンジン・PHP保存処理・ブロック属性・API契約に変更なし。
- Phase5の差分は既存12ファイル更新／新規7ファイル。既存12件は編集JS3件、翻訳ファイル6件、辞書と翻訳生成ツール、コマ編集テスト。新規7件は本資料・readmeドラフト・履歴ドラフト・マニュアルMD／JSON・抽出CSV・翻訳テスト。
- 作業前：18追跡変更／17未追跡／0ステージ。作業後：21追跡変更／24未追跡／0ステージ。ブランチ／HEAD／indexを保持。今回の追加分以外の既存未コミット差分はハッシュ不変。
- 元Free・旧worktree・Pro（Codex管理参照の通常更新を除く）・SDK197件・Pro保護PNG14件・既存ZIP／ProductionCandidateをハッシュ照合し不変。元FreeのPNGも全体照合で保護。
- 独立Freeのshow-ref／fsck終了0、既知dangling110件を保持、desktop.ini再生成0。
- Git保存、ZIP生成、バージョン変更、サイト／DB／サーバー操作、GlotPress／SVN／Freemius操作は行っていない。
