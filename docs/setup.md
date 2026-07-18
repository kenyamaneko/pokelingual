# セットアップ

## ローカル開発環境

ローカル開発は Google Cloud リソース不要。mock モード（`APP_MODE=mock`）では外部 API（Firebase Auth, PokeAPI, Gemini）の代わりにモック実装を使用し、永続化は Docker 内の Firestore Emulator を使う。

```bash
git clone <repo-url>
cd pokelingual

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

mock モードでは認証なし・モックデータで動作する。ヘッダーに「LOCAL」バッジが表示される。

### テスト

```bash
# 全テスト実行
make test

# バックエンドのみ（型チェック）
cd backend && npx tsc --noEmit

# フロントエンドのみ
cd frontend && npx vitest run
```

## 別環境での構築

このリポジトリをクローンして別の Google Cloud プロジェクトで動かすための手順。

### 前提条件

- Node.js 22+
- Docker / Docker Compose
- Terraform 1.5+
- gcloud CLI（認証済み）
- GitHub リポジトリ

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

state は環境ごとに別プロジェクトの GCS バケットへ保存する（dev/prod が別プロジェクトのため）。

```bash
# tfstate 用バケットを環境ごとに作成（初回のみ）
gcloud storage buckets create gs://my-pokelingual-dev-tfstate \
  --project=my-pokelingual-dev --location=asia-northeast1 \
  --uniform-bucket-level-access --public-access-prevention=enforced
gcloud storage buckets update gs://my-pokelingual-dev-tfstate --versioning

gcloud storage buckets create gs://my-pokelingual-prod-tfstate \
  --project=my-pokelingual-prod --location=asia-northeast1 \
  --uniform-bucket-level-access --public-access-prevention=enforced
gcloud storage buckets update gs://my-pokelingual-prod-tfstate --versioning
```

```bash
cd terraform

# tfvars と backend 設定を自分のプロジェクトに合わせて編集
# environments/dev/terraform.tfvars, environments/dev/backend.gcs.tfbackend
#   project_id  = "my-pokelingual-dev"
#   environment = "dev"
#   region      = "asia-northeast1"
#   (backend.gcs.tfbackend の bucket も上で作成したバケット名に合わせる)

# dev 環境
terraform init -backend-config=environments/dev/backend.gcs.tfbackend
terraform apply -var-file=environments/dev/terraform.tfvars

# prod 環境 (別プロジェクトの state に切り替えるため -reconfigure が必要)
terraform init -backend-config=environments/prod/backend.gcs.tfbackend -reconfigure
terraform apply -var-file=environments/prod/terraform.tfvars
```

Terraform が作成するリソース:
- Firebase プロジェクト + Web アプリ
- Firestore データベース + セキュリティルール
- Identity Platform（メール/パスワード認証）
- Artifact Registry（Docker イメージ保管）
- Workload Identity Federation（GitHub Actions → Google Cloud 認証）
- Cloud Monitoring アラート
- サービスアカウント + IAM（Vertex AI 呼び出し用の `roles/aiplatform.user` を含む）

> API 有効化直後にリソース作成が失敗する場合がある。その場合は再度 `terraform apply` を実行。

Gemini はサービスアカウントの ADC（Application Default Credentials）経由で Vertex AI を呼び出すため、API キーの発行・保存は不要。

インフラ変更を既存環境に反映する場合も、上記と同じ `terraform apply` コマンドを使う。

### Firebase ユーザーの作成

サインアップ UI はないため、Firebase Console で手動作成する。

1. [Firebase Console](https://console.firebase.google.com/) → プロジェクト選択
2. Authentication → Users → Add user
3. メールアドレスとパスワードを入力

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

#### ポケモンスナップショットの生成と配置

real モードの backend は起動時に、非公開の Cloud Storage バケットからポケモンの種別データのスナップショットを読み込む。スナップショットが未配置だと起動に失敗するため、backend をデプロイする前に次を済ませておく。`main` への push は dev へ自動デプロイされるので、この変更をマージする前に dev で 1〜3 を実行する。prod も次の `v*` タグ push の前に同じ手順を行う。

1. `terraform apply`（前述「Terraform でインフラ構築」）でバケット `PROJECT_ID-pokemon-snapshot` を作成する。
2. `PokeAPI/api-data` のローカルクローンからスナップショットを生成する。生成物はポケモン社の著作物を含むため、公開リポジトリにコミットしない。`--max-id` は取得する末尾の図鑑番号で、対象バージョン（X〜ソード/シールド）の EN/JA 説明文が揃う第 8 世代の全国図鑑上限 898 を指定する。
   ```bash
   git clone --depth 1 https://github.com/PokeAPI/api-data.git
   cd backend
   npm run generate-snapshot -- --api-data ../api-data --out pokemon-snapshot.json --max-id 898
   ```
3. バケットへアップロードする。
   ```bash
   gcloud storage cp pokemon-snapshot.json gs://PROJECT_ID-pokemon-snapshot/pokemon-snapshot.json
   ```

生成スクリプトを再実行するのは、取得範囲（`--max-id`、既定 898）を広げるときと、レコードに含める項目を増やすときに限る。

ローカルの real モードで動かす場合は、`POKEMON_SNAPSHOT_URI` にローカルの JSON パス（例: `./pokemon-snapshot.json`）を指定すると Cloud Storage の代わりにそのファイルを読む。

#### 初回デプロイ

初回は Cloud Run サービスがまだ存在しないため、手動でデプロイする:

```bash
# バックエンド（ビルドコンテキストはリポジトリルート。shared/api-types を含むため）
docker build -f backend/Dockerfile -t REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial .
docker push REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial
gcloud run deploy pokelingual-api-dev \
  --image REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial \
  --region asia-northeast1 --project PROJECT_ID \
  --service-account pokelingual-api-dev@PROJECT_ID.iam.gserviceaccount.com \
  --update-env-vars "APP_MODE=real,APP_ENV=dev,GEMINI_MODEL=gemini-2.5-flash,FRONTEND_URL=https://PROJECT_ID.web.app,GOOGLE_CLOUD_PROJECT=PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,PER_USER_DAILY_LIMIT=30,GLOBAL_DAILY_LIMIT=1500,POKEMON_SNAPSHOT_URI=gs://PROJECT_ID-pokemon-snapshot/pokemon-snapshot.json" \
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
