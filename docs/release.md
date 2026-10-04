# ローカル配布ZIPの作成と検証

この処理はテスト用ZIPをローカルに生成する。Version変更、Git操作、公開、WordPressへの直接反映は行わない。

## 実行

PowerShellと、PATHから利用できるPHP CLI・Node.jsが必要。プロジェクト直下から実行する。

```powershell
.\scripts\build-release.ps1
```

同じVersionのZIPがある場合は停止する。内容を更新した同Versionのローカルテスト用ZIPに置き換えるときだけ、次を指定する。

```powershell
.\scripts\build-release.ps1 -Force
```

出力先は `release/mangafocus-{Version}.zip`。Versionは本体ヘッダーから取得し、readme.txtのStable tagとの一致も検査する。検査に失敗した場合、既存の完成ZIPは保持される。生成候補は一意な一時ZIPに書き、検証後に配置するため、一時ディレクトリの再帰削除は行わない。

## 梱包と検査

本体、readme、Feature/Capability/Extension API、2つのブロック、コマ読み、解析データ管理、管理画面CSS/JSなど、Freeの実行に必要なファイルだけを明示的に梱包する。全エントリーは `mangafocus/` の下に置く。必要な実行ファイルを追加したときは、スクリプトのruntimeFilesも更新する。

docs、tests、release、Git管理情報、node_modules、desktop.ini、関連プロジェクトは梱包しない。現在のPHP、JavaScript、CSSは未圧縮の実行用ソースとして含め、再現用の`scripts/build-release.ps1`も同梱する。

必須ファイル・バージョン・ブロック名とtextdomain・PHP/JS構文を確認し、ZIP内の全実行時ファイルの内容を元ファイルとSHA-256で照合する。PHPかNodeが使えなければ停止する。生成ZIP全体のSHA-256も表示する。構文検査は実行に使ったPHPのバージョンでの検査であり、PHP 7.4互換の実証やWordPress実機検査の代わりにはならない。

## WordPressでの受け入れ確認

2026-10-04に利用者環境で、旧プラグインからMangaFocusへの入れ替え、管理画面表示、Pro無効時のコマ読みを確認し、問題なしとの報告を受けた。WordPress、PHP、ブラウザーの詳細なバージョンは未記録。

本番ではなく検証用サイトで、作成したZIP自体をインストールして確認する。

1. MangaFocus単独で有効化し、同名カテゴリのブロックを挿入する。
2. 画像を3枚以上選択し、並び替え・削除・保存・編集画面再読込を行う。
3. PC/スマホのコマを別に設定して保存し、再読込後も座標・順番・倍率が復元されることを確認する。
4. 公開画面でページ送り・コマ読み・左右綴じ・実端末スワイプ・モーダル開閉を確認する。方向仕様の既知課題はphase-1-report.mdを参照。
5. CNI Blocksを同時有効化し、旧新ブロックを同じ投稿に配置して操作する。
6. 無効化・再有効化とZIP更新後にも投稿データが保持されることを確認する。
7. WP_DEBUG_LOGとブラウザーコンソールを確認する。テストしたWordPress/PHP/ブラウザーの版と結果を記録する。

最低要件のWordPress 6.3/PHP 7.4と、利用予定の環境をそれぞれ確認する。現在はWordPress実機検証を通過済みとは扱わない。

## 2026-09-25の検査結果

- 0.1.0-alphaのZIPを生成し、ルート名・7ファイルの一覧と全内容の一致を確認。
- PHP構文検査、JS構文検査、既存render-smoke.php、browser-smoke.cjsに合格。
- tests/release-smoke.ps1に合格。一時コピーで同版上書き拒否、Version不一致、必須ファイル欠落、JS構文エラー、失敗時の既存ZIP保持、Forceでの置換、開発ファイル除外、一時ZIP後始末を確認。
- 閲覧機能とVersionは変更していない。WordPress実機検査は未実施。

スクリプトの回帰確認は `./tests/release-smoke.ps1` で実行できる。ZIPには含めない。
