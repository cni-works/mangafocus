# 表示モード独立化 Phase 1

対象は独立Free。Version 0.3.0、Extension API 1、ブロック名とViewer APIを維持。WordPress実機、配布ZIP、翻訳カタログ更新は未実施。

## 保存と互換性

- 新属性は `enableInline` (boolean) 1件だけ。PHP/JS属性定義にdefaultを置かない。
- 属性がbooleanでなければ0.3.0の判定。readerは通常表示、coverLauncherは通常OFF・全画面ON。保存済みenableFullscreen=falseでも旧coverの動作は維持。
- 表示モードを操作した時だけ3つのbooleanを確定。開くだけ・他の設定の再保存では移行しない。pages/コマ/CTA/識別キー/他設定を操作しない。
- ライブラリのサニタイズもfalseと省略を区別。Gutenberg本体のparse/serializeと実際のREST保存は実機未検証。編集テストのシリアライズはJSON属性モデル。
- 旧8構成は0.3.0レンダラーとHTML比較。生成stage IDだけ正規化する。

## 新方式と代替表示

7通りを許可。全OFFとコマ未設定のコマ読み単独への切替はUIで阻止し、理由を表示。ライブラリ新規登録APIでは固定400エラー。
通常OFFでも内部ページ・画像情報・Viewer API・拡張コンテキストを保持。新方式のstage/操作群はhidden/inert、非表示ページのARIA・キーボードも抑止。APIのvisiblePagesには隠れた通常表示を含めず、コマ読み中の論理ページとイベントは保持。
新方式の隠れた画像はlazy。初期の全画像寸法プローブとスクロール補助を抑止する。表紙と起動後に必要な画像は取得する。完全な画像通信抑止は保証しない。
不正な新保存値や起動不能のコマ読み単独は、公開時だけ通常表示へ戻す。保存値を更新せず全画面を強制ONにしない。
新方式の全画面単独でAPIなし／リクエスト拒否・例外の場合も公開時だけ通常表示へ戻す。他に起動可能なコマ読みがあれば表紙とコマ読みを維持。旧coverLauncherのAPI非対応時の旧動作はこの新方式用代替の対象外。

## ローカルテスト

`tests/reading-modes-smoke.php`: `MANGAFOCUS_BASELINE_RENDERER` に信頼する0.3.0レンダラーを指定。既存render-smokeの外部CNI依存が別の場所にある場合、読み取り先だけ調整した一時ファイルを `MANGAFOCUS_RENDER_TEST_BOOTSTRAP` に指定。`--pro-cta-fixture` はPro描画だけを読むモック。
`tests/reading-modes-editor-smoke.cjs`: 開く/非モード編集、旧8構成、新7構成、全OFF/コマ未設定の阻止、false/省略とデータ不変。
`tests/reading-modes-browser-smoke.cjs`: headless Edge、1200/390幅、7構成、単ページ/見開き/自動、両綴じ、ページ送り/縦読み、開閉・フォーカス、非表示ページの操作抑止、モバイルコマ、全画面失敗時代替。
`MANGAFOCUS_PRO_ANALYTICS` にProの解析JSパスを指定すると、送信をブラウザ内モックに置き換えて解析イベント名だけ検査する。識別IDや完全Payloadをログへ出さない。
Fullscreen APIはテスト内の代用品。OS全画面、実端末ジェスチャー、WordPress編集保存、Pro保存ガード・解析DBへの実保存は未検証。release-smokeはZIP生成を伴うので実行しない。

## 翻訳と次工程

新gettext文字列: Reading modes / Inline reading / Fullscreen reading / Panel reading / 3つの説明文 / 全OFF・コマ未設定の警告 / Panel reading start positionと開始位置説明。英語msgidで翻訳可能性を維持。既存PO/MO/JSONは変更しない。
実機で旧投稿の開閉と非モード再保存、新規ブロック、ライブラリ再保存、ネイティブFullscreen、タッチ、Pro CTA・解析・保存ガードを検証してから設定画面整理へ進む。旧Free・旧worktree・Pro・SDK・PNG・ZIPは変更しない。

## 最終確認

既存のextensions-browser-smokeとbrowser-smokeも、外部CNI参照先だけを一時コピーで調整して合格。Viewer API、ズーム、左右綴じ、スワイプ、案内矢印、ページ演出、CTAのクリック、解析イベントの既存回帰を確認した。ブラウザのFullscreen APIとREST通信はモックであり、実機の合格を意味しない。
全画面失敗時の表紙・非対応ボタンについて、既存CSSがhiddenを上書きする問題をセルフレビューで発見し、新方式の属性があるViewerに限ってhiddenを優先するCSSと反証テストを追加した。
