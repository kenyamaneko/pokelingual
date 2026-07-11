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
| インフラ | Google Cloud（Cloud Run, Artifact Registry）, Terraform |
| CI/CD | GitHub Actions |
| テスト | Vitest, Testing Library, Playwright |

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [技術判断記録（ADR）](docs/adr/) | 各設計判断の背景・理由・結果 |
| [業務判断記録（BDR）](docs/bdr/) | 仕様・ゲームルールの背景・理由・結果 |
| [トラブルシューティング](docs/troubleshooting.md) | 開発中に遭遇した問題と解決策 |
| [振る舞いカタログ](https://kenyamaneko.github.io/pokelingual/) | テスト名から自動生成したテスト済みの振る舞い一覧（main の CI が更新） |

## ディレクトリ構成

```
├── backend/
│   ├── cmd/server/          # エントリーポイント、依存性注入
│   ├── internal/
│   │   ├── config/          # 環境変数の読み込み
│   │   ├── domain/          # インターフェース定義
│   │   ├── handler/         # HTTP ハンドラー
│   │   ├── middleware/      # 認証、CORS
│   │   ├── types/           # データモデル
│   │   ├── repository/      # Firestore 実装
│   │   ├── router/          # ルーティング定義
│   │   ├── service/         # ビジネスロジック（PokeAPI, Gemini, Quest）
│   │   └── apperror/        # アプリケーション固有エラー型
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # ページコンポーネント
│   │   ├── components/      # 共通コンポーネント
│   │   ├── contexts/        # AuthContext, DevAuthContext
│   │   ├── hooks/           # カスタムフック
│   │   └── config/          # Firebase 設定
│   └── Dockerfile.dev
├── terraform/               # Google Cloud インフラ（dev/prod）
├── scripts/                 # 結合テストスクリプト
├── docs/                    # ドキュメント
├── docker-compose.dev.yml   # ローカル開発環境
└── Makefile
```

## セットアップ（別環境での構築）

このリポジトリをクローンして別の Google Cloud プロジェクトで動かすための手順。

### 前提条件

- Node.js 22+
- Docker / Docker Compose
- Terraform 1.5+
- gcloud CLI（認証済み）
- GitHub リポジトリ

### ローカル開発環境の起動

ローカル開発は Google Cloud リソース不要。外部 API (PokeAPI/Gemini) と認証はモック実装で代替し、永続化は Docker 内の Firestore Emulator を使う。

```bash
git clone <repo-url>
cd pokelingual

# Docker Compose で起動
make dev

# フロントエンド: http://localhost:15151
# バックエンド:   http://localhost:15100
```

mock モードでは認証なし・モックデータで動作する。ヘッダーに「LOCAL」バッジが表示される。

### Google Cloud プロジェクトの準備

dev 環境と prod 環境でそれぞれ Google Cloud プロジェクトを作成する。

```bash
# プロジェクト作成（例）
gcloud projects create my-pokelingual-dev --name="PokeLingual Dev"
gcloud projects create my-pokelingual-prod --name="PokeLingual Prod"

# 課金アカウントのリンク（必須）
gcloud billing accounts list
gcloud billing projects link my-pokelingual-dev --billing-account=BILLING_ACCOUNT_ID
gcloud billing projects link my-pokelingual-prod --billing-account=BILLING_ACCOUNT_ID
```

### Terraform でインフラ構築

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
- Workload Identity Federation（GitHub Actions → Google Cloud 認証）
- Cloud Monitoring アラート
- サービスアカウント + IAM

> API 有効化直後にリソース作成が失敗する場合がある。その場合は再度 `terraform apply` を実行。

### Gemini API キーの設定

```bash
# Gemini API キーを取得（https://aistudio.google.com/apikey）

# Secret Manager にキーを保存
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key \
  --project=my-pokelingual-dev --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key \
  --project=my-pokelingual-prod --data-file=-
```

### Firebase ユーザーの作成

サインアップ UI はないため、Firebase Console で手動作成する。

1. [Firebase Console](https://console.firebase.google.com/) → プロジェクト選択
2. Authentication → Users → Add user
3. メールアドレスとパスワードを入力

### Firestore のホワイトリスト設定

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

### GitHub Actions の設定

#### リポジトリの variables.tf を更新

```hcl
# terraform/variables.tf の github_repo を自分のリポジトリに変更
variable "github_repo" {
  default = "your-username/your-repo"
}
```

#### GitHub Environments を作成

リポジトリの Settings → Environments で `dev` と `prod` を作成する。

以下は機密ではない設定値（プロジェクト ID・ブラウザに出荷される Firebase Web 設定・WIF リソース識別子）なので **Variables** に設定する（Secret ではない）:

| Variable | 説明 | 取得方法 |
|----------|------|----------|
| `WIF_PROVIDER` | WIF プロバイダーのフルパス | `terraform output wif_provider` |
| `WIF_SERVICE_ACCOUNT` | deploy SA のメールアドレス | `terraform output wif_service_account` |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud プロジェクト ID | `my-pokelingual-dev` 等 |
| `FIREBASE_API_KEY` | Firebase Web API キー | `terraform output firebase_api_key` |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン | `PROJECT_ID.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクト ID | = GOOGLE_CLOUD_PROJECT_ID |
| `FIREBASE_STORAGE_BUCKET` | Storage バケット | `PROJECT_ID.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID | `terraform output firebase_messaging_sender_id` |
| `FIREBASE_APP_ID` | Firebase App ID | `terraform output firebase_app_id` |
| `API_BASE_URL` | バックエンド URL | Cloud Run デプロイ後に取得 |

以下は機密なので **Secret** に設定する（dev 環境のみ）:

| Secret | 説明 |
|--------|------|
| `TEST_USER_PASSWORD` | 結合テスト用ユーザーのパスワード（任意の文字列） |

> `TEST_USER_EMAIL` は deploy.yml 内でハードコード（`test@pokelingual.dev`）
> Firebase Web API キー・プロジェクト ID 等はブラウザに出荷される公開値のため、Secret ではなく Variable として扱う。

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
  --update-env-vars "APP_MODE=real,GEMINI_MODEL=gemini-2.5-flash,FRONTEND_URL=https://PROJECT_ID.web.app,GOOGLE_CLOUD_PROJECT=PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,PER_USER_DAILY_LIMIT=30,GLOBAL_DAILY_LIMIT=1500" \
  --allow-unauthenticated

# API_BASE_URL を取得して GitHub Variables に設定
gcloud run services describe pokelingual-api-dev --region asia-northeast1 --format 'value(status.url)'
```

以降は `main` への push で dev、`v*` タグ push で prod に自動デプロイされる。

### デプロイワークフローの環境固有値を更新

`.github/workflows/deploy-dev.yml`（dev）と `.github/workflows/deploy-prod.yml`（prod）内の以下の値を自分の環境に合わせて変更:

```yaml
# FRONTEND_URL（各ファイルにハードコード）
#   deploy-dev.yml:  https://YOUR-DEV.web.app
#   deploy-prod.yml: https://YOUR-PROD.web.app

# サービス名（各ファイルの env.SERVICE_NAME）
#   deploy-dev.yml:  pokelingual-api-dev
#   deploy-prod.yml: pokelingual-api-prod
```

## ローカル開発

Docker Compose でフロントエンド・バックエンド・Firestore Emulator を起動。mock モード（`APP_MODE=mock`）では外部 API（Firebase Auth, PokeAPI, Gemini）の代わりにモック実装を使用し、永続化は Emulator に接続する。

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
- フロントエンド：http://localhost:15151
- バックエンド API：http://localhost:15100

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

### PR → `main`（`ci.yml`）

```
lint・バックエンドテスト・フロントエンドテスト（並行） + E2E → デプロイなし
```

ランナー上のテストが品質の主ゲートで、green までデプロイしない。

### `main` マージ（dev 環境）

```
push → CI 再実行 → バックエンドデプロイ → デプロイ後スモーク
                   フロントエンドデプロイ・振る舞いカタログ公開（並行）
```

デプロイ後スモークは、デプロイ済み Cloud Run にヘルスと認証付き read を 1 本ずつ叩く検出専用（書き込みなし・自動ロールバックなし、ADR-015）。

### タグ `v*`（prod 環境）

```
tag → バックエンドデプロイ（同一コミットを prod へ再ビルド・再テストなし） → フロントエンドデプロイ
```

振る舞いカタログはテスト済みの振る舞いを一覧できる仕様ドキュメントで、`main` マージ時点の仕様として [GitHub Pages](https://kenyamaneko.github.io/pokelingual/) に公開する。PR では job summary に同じ一覧が出る。

### ワークフロー

| ファイル | トリガー | 内容 |
|---------|---------|------|
| `ci.yml` | PR, workflow_call | バックエンド/フロントエンドテスト・lint・型チェック、E2E、Terraform fmt、振る舞いカタログの job summary 出力 |
| `deploy-dev.yml` | push to `main` | CI 再実行 → dev デプロイ → スモーク → 振る舞いカタログ公開 |
| `deploy-prod.yml` | `v*` タグ push | prod へ再ビルド・デプロイ（再テストなし） |

### prod リリース手順

SemVer（`vMAJOR.MINOR.PATCH`）の Git タグでバージョンを管理する。

```bash
# 1. feature/xxx → main に PR をマージ（dev デプロイが実行される）

# 2. main でタグ付け → タグ push で prod デプロイ（クリーンなバージョン番号）
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0
```

タグ付け後に `main` へ追加コミットが積まれれば、dev 環境のバージョンは `v1.0.0-N-g<sha>`（リリースから N コミット先）と表示される。

## API エンドポイント

全エンドポイントは `/api` プレフィックス付き、Firebase Auth トークンが必要。

### Quest

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/quest/new` | 新しいクエスト開始。ランダムなポケモンの英語説明文を返す |
| POST | `/api/quest/score` | 翻訳を送信し、AI スコアを取得 |
| POST | `/api/quest/guess-name` | ポケモンの名前を推測（EN/JA対応、ファジーマッチ有り） |
| POST | `/api/quest/capture` | スコアと名前推測に基づいた確率で捕獲を試みる |

### Pokedex

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/pokedex` | 捕獲済みポケモン一覧 |
| GET | `/api/pokedex/:id` | ポケモン詳細（EN/JA 説明文ペア含む） |

### Settings

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/settings` | ユーザー設定取得 |
| PUT | `/api/settings/excluded-pokemon` | 除外ポケモンリスト更新 |

## デプロイ

| 環境 | Google Cloud プロジェクト | フロントエンド | バックエンド |
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

<!-- DRAFT: 最終稿は人間が編集する -->
## コスト設計

公開運用を月予算 5,000円 に収めるための設計。詳細は [ADR-011](docs/adr/011-rate-limiting.md)。

### Gemini 呼び出しコスト（thinking 無効化後）

| 項目 | 値 |
|---|---|
| スコアリング 1 回 | 約 0.09円（入力 800tok + 出力 150tok） |
| チャット 1 往復 | 約 0.13円（入力 1,200tok + 出力 200tok） |
| AI 1 呼び出し平均 | 約 0.11円 |

`gemini-2.5-flash` の `thinkingBudget: 0` で thinking トークン課金を無効化（約 4 倍のコスト削減）。

### 二段の防御

1. **アプリ層レートリミット（実質的な上限装置）**
   - 1 ユーザー: 30 回/日
   - 全体: 1,500 回/日
   - JST 0:00 リセット
   - 上限到達時は 429 + 博士口調モーダル
2. **Google Cloud Billing Budget アラート（保険）**
   - 月予算 5,000円 の 50/80/100% でメール通知
   - 自動停止は実装しない（通知遅延があるため、アプリ層の上限が主防御）

### 最大コスト試算

仮にグローバル上限 1,500 回/日を毎日使い切られたとしても、`1,500 × 30 × 0.11 = 約 4,950円`。
月予算ぴったりに収まる設計。

<!-- DRAFT: 最終稿は人間が編集する -->
## ライセンス & 法的事項

このアプリケーションは **非公式のファンメイドアプリ**であり、株式会社ポケモン・任天堂・ゲームフリーク等とは
一切関係ありません。

- ポケモン、Pokémon、ポケモンのキャラクター名・画像・図鑑説明文は、株式会社ポケモン・任天堂・ゲームフリーク等の
  商標または著作物です
- データソースとして [PokeAPI](https://pokeapi.co/) を利用しています。PokeAPI の
  [Fair Use Policy](https://pokeapi.co/docs/v2#fairuse) に準拠し、非商用・個人利用に限定します
- 本アプリは収益化を行いません
- 権利者からの申し立てがあった場合は、速やかにサービスを停止します
