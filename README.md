# PokeLingual

ポケモンの英語図鑑説明文を日本語に翻訳して、ポケモンを捕まえるゲーム。

英語の説明文が表示され、それを日本語に翻訳 → AI がスコアリング → ポケモンの名前を当てる → スコアに応じた確率で捕獲。翻訳の正確さとポケモン知識の両方が試される。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19, TypeScript, Vite, Tailwind CSS |
| バックエンド | Go 1.25, Gin |
| データベース | Cloud Firestore |
| 認証 | Firebase Authentication（メール/パスワード） |
| AI スコアリング | Gemini API（gemini-2.5-flash） |
| ポケモンデータ | PokeAPI |
| インフラ | GCP（Cloud Run, Artifact Registry, Secret Manager）, Terraform |
| CI/CD | GitHub Actions |
| テスト | Go testing, Vitest, Testing Library |

## アーキテクチャ

クリーンアーキテクチャを採用。サービス層はインターフェースに依存し、具象型に依存しない。

```
Handler（HTTP層）→ Service（ビジネスロジック）→ Domain Interfaces → Repository / 外部API
```

主要なインターフェース（`backend/internal/domain/interfaces.go`）：
- `PokemonFetcher` — ポケモンデータ取得（PokeAPI / devmock）
- `AIScorer` — 翻訳スコアリング（Gemini / devmock）
- `UserPokemonRepository` — 捕獲データ永続化（Firestore / devmock）
- `UserSettingsRepository` — ユーザー設定（Firestore / devmock）

## ディレクトリ構成

```
├── backend/
│   ├── cmd/server/          # エントリーポイント、依存性注入
│   ├── internal/
│   │   ├── config/          # 環境変数の読み込み
│   │   ├── domain/          # インターフェース定義
│   │   ├── handler/         # HTTP ハンドラー
│   │   ├── middleware/      # 認証、CORS
│   │   ├── model/           # データモデル
│   │   ├── repository/      # Firestore 実装
│   │   ├── router/          # ルーティング定義
│   │   ├── service/         # ビジネスロジック（PokeAPI, Gemini, Quest）
│   │   ├── devmock/         # ローカル開発用モック実装
│   │   └── testutil/        # テスト用モック
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # ページコンポーネント
│   │   ├── components/      # 共通コンポーネント
│   │   ├── contexts/        # AuthContext, DevAuthContext
│   │   ├── hooks/           # カスタムフック
│   │   └── config/          # Firebase 設定
│   └── Dockerfile.dev
├── terraform/               # GCP インフラ（dev/prod）
├── scripts/                 # 結合テストスクリプト
├── docker-compose.dev.yml   # ローカル開発環境
└── Makefile
```

## ローカル開発

Docker Compose でフロントエンド・バックエンドを起動。dev モードでは外部 API（Firebase, PokeAPI, Gemini）の代わりにモック実装（devmock）を使用する。

```bash
# 起動
make dev

# 停止
make dev-down

# 再起動（リビルド込み）
make dev-restart

# ログ確認
make dev-logs
```

起動後のアクセス先：
- フロントエンド: http://localhost:15151
- バックエンド API: http://localhost:15100

## テスト

```bash
# 全テスト実行
make test

# バックエンドのみ
cd backend && go test ./... -v

# フロントエンドのみ
cd frontend && npx vitest run
```

## CI/CD

GitHub Actions で自動テスト・デプロイを実行。

### develop ブランチ（dev 環境）

```
push → 単体テスト・lint → バックエンドデプロイ → 結合テスト → フロントエンドデプロイ
                                                    ↓ (失敗時)
                                                自動ロールバック
```

結合テストでは、デプロイ済みの Cloud Run サービスに対して実際の API リクエストを送信し、PokeAPI・Gemini・Firestore・Firebase Auth を含む全フローを検証する。テスト後は Firestore のテストデータを自動削除。

### main ブランチ（prod 環境）

```
push → 単体テスト・lint → バックエンドデプロイ + フロントエンドデプロイ（並列）
```

### ワークフロー

| ファイル | トリガー | 内容 |
|---------|---------|------|
| `ci.yml` | PR, workflow_call | Go テスト・lint、フロントエンドテスト・lint・型チェック、Terraform fmt |
| `deploy.yml` | push to main/develop | CI → デプロイ → 結合テスト（dev のみ） |

## API エンドポイント

全エンドポイントは `/api` プレフィックス付き、Firebase Auth トークンが必要。

### Quest

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/quest/new` | 新しいクエスト開始。ランダムなポケモンの英語説明文を返す |
| POST | `/api/quest/score` | 翻訳を送信し、AI スコアを取得 |
| POST | `/api/quest/guess-name` | ポケモンの名前を推測（EN/JA対応、ファジーマッチ有り） |
| POST | `/api/quest/capture` | スコアと名前推測に基づいた確率で捕獲を試みる |

### Collection

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/collection` | 捕獲済みポケモン一覧 |
| GET | `/api/collection/:id` | ポケモン詳細（EN/JA 説明文ペア含む） |

### Settings

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/settings` | ユーザー設定取得 |
| PUT | `/api/settings/excluded-pokemon` | 除外ポケモンリスト更新 |

## デプロイ

| 環境 | GCP プロジェクト | フロントエンド | バックエンド |
|------|----------------|---------------|-------------|
| dev | pokelingual-dev | Firebase Hosting | Cloud Run |
| prod | pokelingual-prod | Firebase Hosting | Cloud Run |

インフラは Terraform で管理（Cloud Run は GitHub Actions が作成・更新）。

```bash
cd terraform
terraform workspace select default  # dev
terraform apply -var-file=environments/dev/terraform.tfvars

terraform workspace select prod
terraform apply -var-file=environments/prod/terraform.tfvars
```
