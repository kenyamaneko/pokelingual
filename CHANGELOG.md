# Changelog

バージョン履歴。[SemVer](https://semver.org/) に準拠。

## [Unreleased]

### Added
- SemVer バージョニング導入（Git タグベース、`git describe` で自動検出）
- `v*` タグ push で prod デプロイが実行されるようになった
- Docker イメージにバージョンタグを付与
- 対象ポケモンを Gen 8 まで拡張（MaxPokemonID: 649 → 898）
- MaxPokemonID を Firestore `config/app` で管理可能に（ハードコード廃止）
- クモ系除外ポケモンに #751 Dewpider, #752 Araquanid を追加

### Changed
- 除外ポケモンをグローバルハードコードからユーザーごとの設定に変更（Firestore `config/app.default_excluded_pokemon_ids` でデフォルト管理）
- 設定画面のバージョン表示: コミットハッシュ → SemVer バージョン
- 設定画面の除外ポケモン ID 上限を API から動的に取得

---

## Pre-release History

初回タグ（`v1.0.0`）以前の開発履歴。

### AI レビューコメント + UI テキスト刷新 (60f9679)
- 翻訳スコアリングに AI の一行レビューコメントを追加（Gemini API）
- 全 UI テキストをひらがなから漢字 + スペース区切りスタイルに変更
- ボール入手の演出を「投げる」から「手に入れた / つかう」に変更
- 説明文バージョン不一致バグを修正（EN/JA が同一バージョンからペアリング）

### Cloud Monitoring + ロギング (1543c1a, 727cfd4)
- Terraform で Cloud Monitoring アラートを追加（5xx、レイテンシ、エラーログ）
- Cloud Logging 互換の構造化ログ出力（`slog` JSON ハンドラー）

### CI/CD 安定化 (7a21d18, d214c5c, e14d335)
- デプロイ後に `--to-latest` でトラフィックを最新リビジョンにルーティング
- 結合テストの強化（prod モード検証、IAM 伝播待機、リソースクリーンアップ）
- deploy SA に Firestore 権限を付与
- `API_BASE_URL` シークレットの追加とドキュメント整備

### 結合テスト導入 (7864037, 6feb65a)
- dev 環境向け結合テスト（PokeAPI + Gemini API + Firestore）
- テスト失敗時の自動ロールバック
- テストリソースの自動クリーンアップ

### 認証 + インフラ (5bca05e, bc6ba12, d16e8de, ed24ef5)
- Firebase Authentication（メール/パスワード）導入
- Workload Identity Federation（JSON キーレス認証）
- Cloud Run IAM を `allUsers` に設定（Firebase Auth トークン対応）
- CI/CD パイプライン構築（GitHub Actions）

### 初回コミット (87019e7)
- PokeLingual アプリケーション初期実装
- クエスト（翻訳 → スコアリング → 名前推測 → 捕獲）フロー
- コレクション（図鑑）機能
- PokeAPI 連携（Gen 1-5、EN/JA 説明文ペアリング）
- Terraform による GCP インフラ管理
