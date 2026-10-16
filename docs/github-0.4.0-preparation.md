# GitHub 0.4.0 公開準備・承認対象

現時点では計画のみ。Gitコミット・リモート設定・fetch・push・main変更・タグ／Release作成・SVN公開は未実施。

## 確認した履歴

GitHub main / ローカルmain: 933ef9305c051f4bb93dc2f213d4243b26f8d65b（0.1.0-alpha）。
作業HEAD: 9f26de203c3e6a7a1909fbba195b0de7a0270809。
共通祖先はmain自身。main固有0件、HEAD側13件で、現時点では履歴の分岐なし。
既存0.3.0タグのコミットはf8b5ae22455546446a1d05176255411dd75cc52b。旧ai-manga-viewer.phpを含む改名前の版。変更しない。
9f26de2は公式0.3.0の34配布ファイルを記録した基準。現在の0.4.0開発はこの基準からの未コミット差分。

## 推奨手順（次段階で承認が必要）

1. originをhttps://github.com/cni-works/mangafocusへ明示設定（現在未登録）。書込み前に接続先と権限を確認。
2. fetchしてmain・タグ・競合する0.4.0タグの有無を再確認。mainが変化・分岐した場合は停止し、今回の計画を再評価。
3. main整理を別途承認後、mainをまず公式公開済み0.3.0基準9f26de203c3e6a7a1909fbba195b0de7a0270809へfast-forwardする。現mainはその祖先なので履歴上書きは不要。ブランチ保護等でPRが必要なら基準ブランチからのPRを先にレビューする。既存13コミットと0.3.0タグは変更しない。
4. 現feature/free-reading-modes-ui-next上で関連差分のみ目的別コミットし、featureだけ通常push。0.3.0基準へ整理済みのmain宛てPRを作成する。これにより0.4.0のレビューを公開0.3.0からの差分に絞る。force、squash、rebaseは使用しない。
5. 0.4.0の公開承認・PRレビュー後、通常のmerge commitでmainへ統合する。準備だけの段階では0.4.0へ進めない。GitHub mainが事前想定から変化していた場合は自動実行せず再確認する。
6. mainの確定コミットから再生成し、準備済み0.4.0 ZIPとの内容一致を確認。新規タグ0.4.0をそのコミットへ作成。既存0.3.0タグは維持。
7. GitHub Releaseに正式ZIPと日本語ノートを添付。GitHub自動生成Source code ZIPと区別。Releaseの公開タイミングはWordPress.org公開と合わせて承認する。
8. 別途承認された段階で、正式ZIP内の配布ファイルだけをSVN trunk/とtags/0.4.0/へ反映。Stable tagを整合し、必要なRelease Confirmation後、公式ZIP/API/更新検出を確認。

GitHub Actions・Webhookによる自動公開は未設定。GitHubへpushしてもWordPress.orgには自動反映されない。
配布コードと開発用テスト／資料／ビルダーは区別する。ZIP、バックアップ、PNG保護対象、Proコード、秘密情報はコミットしない。
コミット対象の具体的な一覧とZIPハッシュは作業完了時の別監査記録で提示する。
