# Phase 8C-3：Pro Add-on bootstrap

## 配置と識別

ProはFree Coreリポジトリ内へ置かず、同じ`plugins`ディレクトリの兄弟ソースツリー`AI Manga Viewer Pro`で管理する。WordPress plugin directory / slugは`ai-manga-viewer-pro`、Plugin Nameは`AI Manga Viewer Pro`、初期Versionは`0.1.0-alpha`とする。Core Version `0.3.0-alpha`とは同期させず、互換判定にはExtension API majorを使う。

Free用Release ZIPは明示的なruntime allowlistだけを収録し、ProのPHP、README、test、scriptを含めない。Proも専用build scriptで別ZIPを生成し、rootを`ai-manga-viewer-pro/`に固定する。Pro側にGit repositoryはまだ作成しない。

## Bootstrap lifecycle

Pro plugin fileは自身の定数とbootstrap関数だけを読み込み、`plugins_loaded` priority 20で依存確認を行う。全active plugin fileの読み込み後に判定するため、ProファイルがCoreより先にincludeされても誤ってCore不在と確定しない。

状態は次の3種類とする。

- `booted`: Core Feature APIとExtension API Version 1を確認済み
- `core_missing`: Coreが未導入、無効、削除済み、またはFeature APIが存在しない
- `api_incompatible`: Extension APIが存在しない、必要なPHP renderer APIが欠ける、またはmajorが1ではない

`ai_manga_viewer_pro_is_ready()`は`booted`の場合だけtrueを返す。依存不成立でもPro自体を自動停止せずsafe-disabledとし、frontendへ出力しない。管理画面では`activate_plugins`権限を持つ利用者にだけエラーnoticeを出す。正常時の常設noticeは出さない。Coreを再有効化した場合は次のrequestの`plugins_loaded`で再評価され、Proの再有効化を必要としない。

## 依存契約

ProはCoreのFeature API、Extension API Version 1、文書化されたEditor filters、Renderer filters、Frontend Viewer APIとCustomEventだけへ依存する。Coreのplugin Version文字列、DOM class、closure state、private function、DB内部構造は互換条件にしない。

`Requires Plugins` headerは現段階では使わない。Coreには安定したWordPress.org plugin identityがなく、headerによる導入制御だけでは無効化・削除・非互換を扱えないためである。配布経路が確定した後に再評価するが、runtime guardは維持する。

## 現在の範囲

Phase 8C-3ではCTA、panel reader、Analytics、AI Consultationを移動せず、Core Feature APIの4項目もtrueのままとする。ライセンス、Capability、更新、遠隔通信、購入判定、改ざん検知、secret、domain例外は実装しない。Proはデータを所有しないためuninstall処理も持たない。

Multisiteは正式対応範囲へ追加しない。bootstrap自体はサイト・network activationを仮定せず、各requestで公開APIを確認するため、network activationだけを理由にfatalを発生させない構造とする。実際のnetwork管理画面とサイト単位の有効化は将来実機確認する。

## 次段階

Phase 8C-4ではPro側へ`includes/modules/analytics/`を追加し、共通bootstrapのready判定後だけ読み込む。Core Extension APIの一般Viewer eventをAnalyticsイベントへ変換し、CoreのDB lifecycleと保存互換を維持する。CTA、panel reader、AI Consultationも後続の個別moduleとして同じ入口を利用する。
