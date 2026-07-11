# Changelog

バージョン履歴。[SemVer](https://semver.org/) に準拠。

## [Unreleased]

### Fixed
- LLM 採点プロンプトに渡す出題英文からポケモン名を伏せ、博士の講評でポケモン名が判明してしまう問題を修正

### Changed
- ポケモン図鑑の呼称を collection から pokedex に統一（API パス `/api/collection` → `/api/pokedex`、契約型・画面ルート・ファイル名を含む）
- `APP_MODE` を必須化（未設定・未知値は起動エラー、mock への暗黙フォールバックを廃止）し、実サービス接続モードの値を `prod` から `real` にリネーム（環境名との混同を避け、mock でないことが読み取れる値にする）
- LLM 採点レスポンスの `review` 欠落・空文字をエラーとして扱うように変更（無検証で空講評が画面に出るのを防止）
- Gemini のモデル名をハードコードから `GEMINI_MODEL` 環境変数に外出し（real モードでは必須、deploy.yml が注入）
- CI / Deploy の全ジョブを Ubicloud ランナー（`ubicloud-standard-2`）で実行するように変更
- モック LLM の講評・チャット文言を、モックであると分かる文言に変更

### Added
- 除外ロジックを「ユーザー設定による除外」と「開発者除外（prod 以外の環境のみ）」に分離し、出題と図鑑の両方に適用
- 実行環境を表す `APP_ENV` 環境変数を導入（`local` / `dev` / `prod`。定義外の値は起動エラー）
- Playwright E2E テスト導入（クエスト全フロー、図鑑、ナビゲーション、6テスト）
- CI に E2E テストジョブ追加（Docker Compose mock モードで並列実行）

## [1.0.0] - 2026-02-14

### Added
- 博士からのコメントラベル追加（翻訳スコア表示に「博士からの コメント」見出し）
- 博士に質問チャット機能（捕獲結果画面から博士とチャットできるモーダル）
  - AIモデルを活用（Gemini 2.5 Flash）、クリーンアーキテクチャで差し替え可能
  - クエストのコンテキスト（原文、翻訳、スコア、レビュー、ポケモン名）を引き継ぎ
  - Enter キーで改行、ボタンクリックで送信（意図しない送信を防止）
- SemVer バージョニング導入（Git タグベース、`git describe` で自動検出）
- `v*` タグ push で prod デプロイが実行されるようになった
- Docker イメージにバージョンタグを付与
- 対象ポケモンを Gen 8 まで拡張（MaxPokemonID: 649 → 898）
- MaxPokemonID を Firestore `config/app` で管理可能に（ハードコード廃止）
- 開発者が苦手な除外ポケモンに #751, #752 を追加
- 種族値（BST）ベースの捕獲率計算（シグモイド関数、強いポケモンほど捕まえにくい）
- 名前当て結果でボール種類が決定（EN正解→ハイパー、JA正解→スーパー、失敗→モンスター）
- 出題時にポケモン名を伏せ字（EN: "this/these Pokémon"、JA: "この ポケモン"）
- 捕獲結果画面に種族値を表示
- 図鑑詳細・捕獲結果にタイプバッジ（カラー付き）を表示
- 図鑑詳細に身長・体重を表示（PokeAPI のデシメートル/ヘクトグラムを m/kg に変換）
- 伝説・幻ポケモンの特別演出（PokeAPI `is_legendary` / `is_mythical` 活用）
  - 登場時: 「ただならぬ けはいを 感じる…」メッセージ + 背景色変更（伝説=金、幻=紫）
  - devmock に Mewtwo（伝説）テストデータ追加

### Changed
- AI レビュープロンプト改善（親切な博士口調、未翻訳部分の理解、難単語解説、150文字に拡大）
- AI レビューの結び表現にバリエーション追加（毎回同じ褒め言葉にならないように）
- 除外ポケモンをグローバルハードコードからユーザーごとの設定に変更（Firestore `config/app.default_excluded_pokemon_ids` でデフォルト管理）
- `APP_MODE=dev` → `APP_MODE=mock` にリネーム（「開発環境」との名前衝突を解消）
- ヘッダーに環境バッジ追加（LOCAL / DEV 表示、prod は無印）
- `VITE_ENVIRONMENT` 環境変数を追加（local / dev / prod）
- 設定画面のバージョン表示: コミットハッシュ → SemVer バージョン
- 設定画面の除外ポケモン ID 上限を API から動的に取得
- 捕獲確率の計算式を線形からシグモイドに変更（ADR-010）
- 捕獲率チューニング: スコアの効きを強化、ボール倍率をスーパー2.0x/ハイパー3.0xに引き上げ
- 捕獲率緩和: スコア90+スーパーボールで伝説ポケモンもほぼ確実に捕獲可能に
- 名前当て結果のレスポンス: `multiplier` → `ball_type`（poke/great/ultra）
- UI テキスト「コレクション」→「図鑑」、「クエスト」→「冒険」にリネーム（物理名はそのまま）
- UI テキストを全角スペース区切り + 小学校低学年漢字/ひらがな使い分けに統一
- 図鑑の分母（total_available）を常に MaxPokemonID に変更（除外ポケモンの影響を受けない）
- 図鑑グリッドから「発見ずみ」ラベルを削除（グレースケールで判別可能）
- 図鑑詳細からステータスカードを削除、統計グリッドを3列に変更
- チャット吹き出しのテキストを左寄せに変更

### Fixed
- Cloud Run デプロイに `--service-account` フラグを追加（デフォルト Compute Engine SA ではなくカスタム backend SA を使用）
- ESLint `no-irregular-whitespace` ルールで全角スペースを許可（`skipJSXText`, `skipTemplates`, `skipStrings`）

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
- Terraform による Google Cloud インフラ管理
