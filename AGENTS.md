# AI Manga Viewer 作業ルール

## 対象と品質

- このプロジェクトだけを変更する。隣接するCNI Blocksその他のプロジェクトは読み取り調査のみ。
- 作業前に構成・プラグインヘッダー・関連docsを確認し、変更前に対象と内容を短く説明する。
- 保存済みブロックと属性の互換性を保ち、入力検証・サニタイズ・出力エスケープを行う。保存処理を追加する場合は必要な権限とnonceを確認する。
- PHP/JS検査と変更に関係する既存テストを実行する。WordPress実機未確認の項目は明記する。本番サイトやWordPress管理画面に直接反映しない。
- Versionは利用者が明示的に指示した場合のみ変更する。α版ではFree/Proの機能制限を追加しない。

## Git運用

- 対象Repository: `cni-works/ai-manga-viewer`
- origin URL: `https://github.com/cni-works/ai-manga-viewer`
- 基準ブランチ: `main`
- 初回のみ、利用者の2026-09-25の明示指示により、現在の0.1.0-alphaを`main`へ初回コミットし、既存の安全な認証が利用可能なら`origin/main`へ初回pushする。
- 今後の通常開発はPhase・機能単位の`feature/...`ブランチで行う。実際に使用するブランチ名を作業開始時に明示する。検査と確認を経てmainへ統合する。
- 通常の開発依頼だけではcommit、push、mainへの統合を行わない。初回設定以降のGitHub書き込みは利用者が「バックアップして」「リリースして」など対象操作を明示したときだけ行う。
- GitHub操作前にGitルートがこのプロジェクトであること、originが上記URLと完全一致すること、操作対象ブランチが今回承認されたmainまたは当該作業で明示・承認されたfeatureブランチと完全一致すること、他プロジェクトの変更を含まないことを確認する。
- push前にfetchし、非fast-forwardまたは履歴の分岐があれば停止する。force pushや既存履歴の破壊は禁止する。
- BuildまたはZIP検証に失敗した場合はcommit/pushへ進まない。
- Tag、GitHub Release、Release Asset操作、自動アップデート機能の導入には別の明示指示が必要。今回の初回保存には含めない。
- 認証情報をSource、Repository、Script、AGENTS.mdへ保存しない。OSのCredential Store等の既存の安全な認証だけを使用する。認証できなければローカルcommitまでとし、残作業を報告する。

## 配布と開発ファイル

- ZIPは`./scripts/build-release.ps1`で生成する。同Versionを置換するときだけ`-Force`を使用する。
- release内のZIPはGit管理しない。空フォルダ維持用の`.gitkeep`だけ追跡する。
- 本体、blocks、scripts、tests、docs、ロードマップ、Git設定ファイルとこのルールを追跡する。
- node_modules、一時build、IDE設定、OS生成ファイル、秘密情報は追跡しない。
- テスト用ZIPの生成は販売開始・実機合格を意味しない。現在の基準点は開発α版として扱う。
