# PokeLingual

ポケモンの英語図鑑説明文を日本語に翻訳して、ポケモンを捕まえるゲーム。

英語の説明文が表示され、それを日本語に翻訳 → AI がスコアリング → ポケモンの名前を当てる → スコアに応じた確率で捕獲。翻訳の正確さとポケモン知識の両方が試される。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19, TypeScript, Vite, Tailwind CSS |
| バックエンド | Node.js 22, Express, TypeScript |
| データベース | Cloud Firestore |
| 認証 | Firebase Authentication（メール/パスワード） |
| AI スコアリング | Gemini（Vertex AI, gemini-2.5-flash） |
| ポケモンデータ | PokeAPI |
| インフラ | GCP（Cloud Run, Artifact Registry）, Terraform |
| CI/CD | GitHub Actions |
| テスト | Vitest, Testing Library, Playwright |

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [アーキテクチャ](docs/architecture.md) | 全体構成、バックエンド/フロントエンド詳細、インフラ |
| [技術判断記録（ADR）](docs/adr/) | 各設計判断の背景・理由・結果 |
| [トラブルシューティング](docs/troubleshooting.md) | 開発中に遭遇した問題と解決策 |

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
├── docs/                    # ドキュメント
├── docker-compose.dev.yml   # ローカル開発環境
└── Makefile
```

## セットアップ（別環境での構築）

このリポジトリをクローンして別の GCP プロジェクトで動かすための手順。

### 前提条件

- Node.js 22+
- Docker / Docker Compose
- Terraform 1.5+
- gcloud CLI（認証済み）
- GitHub リポジトリ

### 1. ローカル開発環境の起動

ローカル開発は GCP リソース不要。devmock が全外部サービスを代替する。

```bash
git clone <repo-url>
cd pokelingual

# Docker Compose で起動
make dev

# フロントエンド: http://localhost:15151
# バックエンド:   http://localhost:15100
```

mock モードでは認証なし・モックデータで動作する。ヘッダーに「LOCAL」バッジが表示される。

### 2. GCP プロジェクトの準備

dev 環境と prod 環境でそれぞれ GCP プロジェクトを作成する。

```bash
# プロジェクト作成（例）
gcloud projects create my-pokelingual-dev --name="PokeLingual Dev"
gcloud projects create my-pokelingual-prod --name="PokeLingual Prod"

# 課金アカウントのリンク（必須）
gcloud billing accounts list
gcloud billing projects link my-pokelingual-dev --billing-account=BILLING_ACCOUNT_ID
gcloud billing projects link my-pokelingual-prod --billing-account=BILLING_ACCOUNT_ID
```

### 3. Terraform でインフラ構築

```bash
cd terraform

# tfvars を自分のプロジェクトに合わせて編集
# environments/dev/terraform.tfvars
#   project_id  = "my-pokelingual-dev"
#   environment = "dev"
#   region      = "asia-northeast1"

# dev 環境
terraform init
terraform workspace select default  # dev workspace
terraform apply -var-file=environments/dev/terraform.tfvars

# prod 環境
terraform workspace new prod  # 初回のみ
terraform workspace select prod
terraform apply -var-file=environments/prod/terraform.tfvars
```

Terraform が作成するリソース:
- Firebase プロジェクト + Web アプリ
- Firestore データベース + セキュリティルール
- Identity Platform（メール/パスワード認証）
- Artifact Registry（Docker イメージ保管）
- Secret Manager（Gemini API キー）
- Workload Identity Federation（GitHub Actions → GCP 認証）
- Cloud Monitoring アラート
- サービスアカウント + IAM

> API 有効化直後にリソース作成が失敗する場合がある。その場合は再度 `terraform apply` を実行。

### 4. Gemini API キーの設定

```bash
# Gemini API キーを取得（https://aistudio.google.com/apikey）

# Secret Manager にキーを保存
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key \
  --project=my-pokelingual-dev --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key \
  --project=my-pokelingual-prod --data-file=-
```

### 5. Firebase ユーザーの作成

サインアップ UI はないため、Firebase Console で手動作成する。

1. [Firebase Console](https://console.firebase.google.com/) → プロジェクト選択
2. Authentication → Users → Add user
3. メールアドレスとパスワードを入力

### 6. Firestore のホワイトリスト設定

バックエンドは起動時に Firestore `config/auth` ドキュメントの `allowed_emails` を読み込む。
このドキュメントがないとサーバーは起動を拒否する。

Firebase Console → Firestore で以下のドキュメントを手動作成:

```
コレクション: config
ドキュメント: auth
フィールド:
  allowed_emails (array)
    - "your-email@example.com"
```

### 7. GitHub Actions の設定

#### リポジトリの variables.tf を更新

```hcl
# terraform/variables.tf の github_repo を自分のリポジトリに変更
variable "github_repo" {
  default = "your-username/your-repo"
}
```

#### GitHub Environments を作成

リポジトリの Settings → Environments で `dev` と `prod` を作成し、以下の Secrets を設定:

| Secret | 説明 | 取得方法 |
|--------|------|----------|
| `WIF_PROVIDER` | WIF プロバイダーのフルパス | `terraform output wif_provider` |
| `WIF_SERVICE_ACCOUNT` | deploy SA のメールアドレス | `terraform output wif_service_account` |
| `GCP_PROJECT_ID` | GCP プロジェクト ID | `my-pokelingual-dev` 等 |
| `FIREBASE_API_KEY` | Firebase Web API キー | `terraform output firebase_api_key` |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン | `PROJECT_ID.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクト ID | = GCP_PROJECT_ID |
| `FIREBASE_STORAGE_BUCKET` | Storage バケット | `PROJECT_ID.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID | `terraform output firebase_messaging_sender_id` |
| `FIREBASE_APP_ID` | Firebase App ID | `terraform output firebase_app_id` |
| `API_BASE_URL` | バックエンド URL | Cloud Run デプロイ後に取得 |

dev 環境のみ追加:

| Secret | 説明 |
|--------|------|
| `TEST_USER_PASSWORD` | 結合テスト用ユーザーのパスワード（任意の文字列） |

> `TEST_USER_EMAIL` は deploy.yml 内でハードコード（`test@pokelingual.dev`）

#### 初回デプロイ

初回は Cloud Run サービスがまだ存在しないため、手動でデプロイする:

```bash
# バックエンド
cd backend
docker build -t REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial .
docker push REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial
gcloud run deploy pokelingual-api-dev \
  --image REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial \
  --region asia-northeast1 --project PROJECT_ID \
  --service-account pokelingual-api-dev@PROJECT_ID.iam.gserviceaccount.com \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --update-env-vars "APP_MODE=prod,FRONTEND_URL=https://PROJECT_ID.web.app" \
  --allow-unauthenticated

# API_BASE_URL を取得して GitHub Secrets に設定
gcloud run services describe pokelingual-api-dev --region asia-northeast1 --format 'value(status.url)'
```

以降は `develop` / `main` ブランチへの push で自動デプロイされる。

### 8. deploy.yml の環境固有値を更新

`.github/workflows/deploy.yml` 内の以下の値を自分の環境に合わせて変更:

```yaml
# FRONTEND_URL（ハードコード箇所）
FRONTEND_URL: ${{ github.ref_name != 'develop' && 'https://YOUR-PROD.web.app' || 'https://YOUR-DEV.web.app' }}

# SERVICE_NAME（必要に応じて変更）
SERVICE_NAME: ${{ github.ref_name != 'develop' && 'pokelingual-api-prod' || 'pokelingual-api-dev' }}
```

## ローカル開発

Docker Compose でフロントエンド・バックエンドを起動。mock モード（`APP_MODE=mock`）では外部 API（Firebase, PokeAPI, Gemini）の代わりにモック実装（devmock）を使用する。

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

# バックエンドのみ（型チェック）
cd backend && npx tsc --noEmit

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
| `deploy.yml` | push to main/develop, v* tag | CI → デプロイ → 結合テスト（dev のみ） |

### prod リリース手順

SemVer（`vMAJOR.MINOR.PATCH`）の Git タグでバージョンを管理する。

```bash
# 1. develop → main に PR をマージ（prod デプロイが実行される）

# 2. main でタグ付け → タグ push で prod 再デプロイ（クリーンなバージョン番号）
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0

# 3. main → develop にマージバック（タグを develop に伝播）
git checkout develop && git pull
git merge main
git push origin develop
```

マージバックにより、dev 環境のバージョンが `v1.0.0-N-g<sha>`（リリースから N コミット先）と表示される。

## API エンドポイント

全エンドポイントは `/api` プレフィックス付き、Firebase Auth トークンが必要。

### Quest

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/quest/new` | 新しいクエスト開始。ランダムなポケモンの英語説明文を返す |
| POST | `/api/quest/score` | 翻訳を送信し、AI スコアを取得 |
| POST | `/api/quest/guess-name` | ポケモンの名前を推測（EN/JA対応、ファジーマッチ有り） |
| POST | `/api/quest/capture` | スコアと名前推測に基づいた確率で捕獲を試みる |
| POST | `/api/quest/chat` | 博士に質問（コンテキスト + メッセージ履歴を送信） |

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
