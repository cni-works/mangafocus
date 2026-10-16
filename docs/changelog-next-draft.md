# 次期変更履歴・Upgrade Notice案（未公開）

0.4.0は候補番号。公開承認・実機試験・最終バージョン確定後にreadmeへ反映する。現在のVersion／Stable tagは0.3.0のまま。公開済み履歴は変更しない。

## Changelog案 / English

```text
= 0.4.0 (draft; unreleased) =

* Added independent inline, fullscreen, and panel reading switches while retaining legacy reading settings until authors explicitly change modes.
* Grouped reading-mode selection and mode-specific settings; disabled modes keep their saved settings.
* Added Cover image controls to the MangaFocus block in Manga Library using the standard WordPress featured image.
* Kept the standard Featured image controls as a fallback and page 1 as a preview when no cover is set.
* Stopped automatically setting or updating the featured image from page 1 while retaining existing covers.
* Improved inline navigation-guide placement without reducing the image width.
* Fixed vertical reading when free zoom is disabled and improved start-page synchronization during vertical reading.
* Updated Japanese localization and clarified scroll adjustment, navigation guides, and smartphone panel settings.
```

## 日本語案

- 通常表示・全画面表示・コマ読みを個別に選択できるようにし、作者がモードを明示変更するまで旧設定の解釈を維持。
- 表示モードを先に選べる構成へ整理。OFFにしても保存済み設定を保持。
- 漫画ライブラリのブロック設定へ表紙画像UIを追加。標準アイキャッチと同じ保存状態を使用し、標準パネルを予備の操作場所として維持。
- 1ページ目からのアイキャッチ自動設定・追従更新を廃止。既存表紙を維持し、未設定時の1ページ目は代替プレビューとして使用。
- 通常表示の案内矢印を、画像幅を縮めず余白または画像下へ配置。
- 自由ズームOFFでの縦読み例外と、縦読み中間開始時のページ同期を修正。
- 設定名称・説明文・日本語翻訳を整理。

## Upgrade Notice案 / English

```text
= 0.4.0 =
Existing comic data and covers are retained. Legacy reading modes remain in effect until you explicitly change a mode. Page 1 is no longer written automatically as the featured image. Review the new Reading modes and Cover image controls after updating. Back up your site before updating.
```

日本語：既存の漫画データと表紙画像は保持します。表示モードを明示変更するまでは旧設定の表示を維持します。1ページ目からのアイキャッチ自動書込みは行いません。更新後は「表示モード」と「表紙画像」を確認してください。更新前にサイトをバックアップしてください。

この文面は実装に基づくドラフトであり、WordPress実機での更新合格・公開可能判定ではない。標準アイキャッチパネルを非表示にしたとは記載しない。
