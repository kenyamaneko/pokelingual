# セットアップ

## 別環境での構築

このリポジトリをクローンして別の Google Cloud プロジェクトで動かすための手順。

### 前提条件

- Node.js 22+
- Docker / Docker Compose
- Terraform 1.5+
- gcloud CLI（認証済み）
- Upstash アカウント（クエストセッションの Redis ストア用）
- GitHub リポジトリ

### Google Cloud プロジェクトの準備

dev 環境と prod 環境でそれぞれ Google Cloud プロジェクトを作成する。

```bash
# プロジェクト作成（例）
gcloud projects create my-pokelingual-dev --name="Pokelingual Dev"
gcloud projects create my-pokelingual-prod --name="Pokelingual Prod"

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

`environments/dev/terraform.tfvars`（prod も同様に `environments/prod/terraform.tfvars`）を自分の環境に合わせて編集する。すべての変数に default 値がなく未設定だと apply が失敗するため、以下を一つずつ確認する。

| 変数 | 説明 | 値の目安 |
|---|---|---|
| `project_id` | Google Cloud プロジェクト ID | `my-pokelingual-dev` |
| `environment` | 環境名 | `dev` / `prod` |
| `region` | リージョン | `asia-northeast1` |
| `pitr_enabled` | Firestore の Point-in-Time Recovery を有効にするか | dev: `false` / prod: `true` |
| `alerts_enabled` | Cloud Monitoring アラートポリシーを作成するか | dev: `false` / prod: `true` |
| `disable_new_user_signup` | 新規ユーザー登録を拒否するか（既存ユーザーのログインは可） | 公開しない環境は `true` |
| `signup_smoke_enabled` | サインアップスモーク用に deploy SA へ Firebase Auth Admin 権限を付与するか | `disable_new_user_signup = false` の環境でのみ `true` |
| `firebase_web_app_display_name` | Firebase Web アプリの表示名 | `Pokelingual` |
| `github_repo` | GitHub リポジトリ（`owner/repo`） | `your-username/your-repo` |
| `alert_email` | Cloud Monitoring 通知先メールアドレス | 自分のメールアドレス |
| `slack_notification_channel_id` | 手動作成した Slack 通知チャネルのリソース名 | 使わないなら `""` |
| `billing_account_display_name` | 請求アカウントの表示名 | 使わないなら `""` |
| `monthly_budget_jpy` | 月次予算の上限（円）。50/80/100% でアラート | `5000` |

`slack_notification_channel_id` は OAuth 認可が必要で Terraform から作成できないため、使う場合は Slack 側で先にチャネルを作成しておく。`""` のままなら Slack 通知なしで進められる。`billing_account_display_name` も `""` なら Billing Budget アラートは作成されない（その場合、コスト超過の検知はアプリ層のレートリミットだけに頼ることになる）。

`backend.gcs.tfbackend` の `bucket` も、上で作成した state 用バケット名に合わせる。

```bash
cd terraform

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
- Identity Platform（メール/パスワード認証。Google Sign-In は後述の手動設定が必要）
- Artifact Registry（Docker イメージ保管）
- Workload Identity Federation（GitHub Actions のデプロイ用と、PR の Terraform Plan 用の 2 系統）
- Cloud Monitoring ダッシュボード、および `alerts_enabled = true` の環境ではアラートポリシー
- `billing_account_display_name` を設定した環境では Billing Budget アラート
- サービスアカウント + IAM（Vertex AI 呼び出し用の `roles/aiplatform.user` を含む）
- Secret Manager のシークレットの箱（Upstash Redis 接続情報用。値は空で作成され、後述の手順で手動投入する）
- ポケモン種別データのスナップショット置き場（非公開 Cloud Storage バケット）

> API 有効化直後にリソース作成が失敗する場合がある。その場合は再度 `terraform apply` を実行。

Gemini はサービスアカウントの ADC（Application Default Credentials）経由で Vertex AI を呼び出すため、API キーの発行・保存は不要。

インフラ変更を既存環境に反映する場合も、上記と同じ `terraform apply` コマンドを使う。

### Upstash Redis のセットアップ

クエストセッションの永続化に使う Redis 互換ストア。Google Cloud のリソースではないため Terraform では作成できず、Upstash 側の作業になる。

1. [Upstash Console](https://console.upstash.com/) でアカウントを作成し、Redis データベースを新規作成する。Cloud Run のリージョン（`asia-northeast1`、東京）に近いリージョンを選ぶとレイテンシが下がる。
2. データベースの接続情報から ioredis 用の接続文字列（`rediss://default:PASSWORD@ENDPOINT:PORT` 形式）を控える。
3. 前段の Terraform が作成したシークレットの箱（`pokelingual-upstash-redis-url`）へ値を投入する。

   ```bash
   echo -n "rediss://default:PASSWORD@ENDPOINT:PORT" | \
     gcloud secrets versions add pokelingual-upstash-redis-url \
     --project=PROJECT_ID --data-file=-
   ```

このシークレットは、後述の初回デプロイで backend の Cloud Run サービスに `UPSTASH_REDIS_URL` として渡す。値が未投入のまま real モードで起動すると、必須環境変数が欠けて起動に失敗する。

### Firebase Authentication の設定

Terraform はメール/パスワード認証を有効化するところまでを担う。Google Sign-In の有効化と動作確認用アカウントの用意は別途必要。

#### Google Sign-In の有効化

client_secret を tfstate に平文で残さないため、google.com IdP の有効化は Terraform 管理外にしている（ADR-022）。[Firebase Console](https://console.firebase.google.com/) → プロジェクト選択 → Authentication → Sign-in method → Google を有効化する。

#### 動作確認用アカウントの用意

`disable_new_user_signup = false` の環境（公開する prod など）では、フロントエンドのサインアップ画面（メール/パスワード）または Google Sign-In からセルフサービスで登録できる。メール/パスワードでの登録は確認メールのリンクをクリックするまでログインできない。

`disable_new_user_signup = true` の環境（dev など）はセルフサービス登録の client SDK 経路自体を拒否するため、開発者アカウントは管理者が手動作成する運用にしている（ADR-036）。

1. [Firebase Console](https://console.firebase.google.com/) → プロジェクト選択 → Authentication → Users → Add user でメールアドレス・パスワードを指定して作成する（Console からの作成は新規登録無効化の対象外）。作成後に表示される User UID を控える。
2. アプリのログインは `emailVerified` を要求するため、Admin REST API で確認済みへ更新する（`scripts/smoke-prod-signup.sh` と同じ方法。実行する gcloud アカウントに Firebase Auth の管理権限が必要）。

   ```bash
   curl -s -X POST \
     "https://identitytoolkit.googleapis.com/v1/projects/PROJECT_ID/accounts:update" \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     -H "Content-Type: application/json" \
     -d '{"localId":"USER_UID","emailVerified":true}'
   ```

### GitHub Actions の設定

#### GitHub Environments を作成

リポジトリの Settings → Environments で `dev` と `prod` を作成する。

以下は機密ではない設定値（プロジェクト ID・ブラウザに出荷される Firebase Web 設定・WIF リソース識別子）なので **Variables** に設定する（Secret ではない）:

| Variable | 説明 | 取得方法 |
|----------|------|----------|
| `WIF_PROVIDER` | WIF プロバイダーのフルパス | `terraform output wif_provider` |
| `WIF_SERVICE_ACCOUNT` | deploy SA のメールアドレス | `terraform output wif_service_account` |
| `TERRAFORM_PLAN_SERVICE_ACCOUNT` | PR の Terraform Plan 用 SA のメールアドレス（dev 環境のみ必須。PR の plan は dev に対してのみ実行される） | `terraform output terraform_plan_service_account` |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud プロジェクト ID | `my-pokelingual-dev` 等 |
| `FIREBASE_API_KEY` | Firebase Web API キー | `terraform output firebase_api_key` |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン | `PROJECT_ID.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクト ID | = GOOGLE_CLOUD_PROJECT_ID |
| `FIREBASE_STORAGE_BUCKET` | Storage バケット | `PROJECT_ID.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID | `terraform output firebase_messaging_sender_id` |
| `FIREBASE_APP_ID` | Firebase App ID | `terraform output firebase_app_id` |
| `API_BASE_URL` | バックエンド URL | Cloud Run デプロイ後に取得 |
| `FRONTEND_URL` | フロントエンドの URL（backend の CORS 許可オリジン） | `https://PROJECT_ID.web.app` |
| `POKEMON_SNAPSHOT_URI` | ポケモン種別データのスナップショット読み込み元 | `gs://PROJECT_ID-pokemon-snapshot/pokemon-snapshot.json` |

以下は機密なので **Secret** に設定する（dev 環境のみ）:

| Secret | 説明 |
|--------|------|
| `TEST_USER_PASSWORD` | 結合テスト用ユーザーのパスワード（任意の文字列） |

> `TEST_USER_EMAIL` は deploy.yml 内でハードコード（`test@pokelingual.dev`）
> Firebase Web API キー・プロジェクト ID 等はブラウザに出荷される公開値のため、Secret ではなく Variable として扱う。

#### ポケモンスナップショットの生成と配置

real モードの backend は起動時に、非公開の Cloud Storage バケットからポケモンの種別データのスナップショットを読み込む。スナップショットが未配置だと起動に失敗するため、backend をデプロイする前に次を済ませておく。`main` への push は dev へ自動デプロイされるので、この変更をマージする前に dev で 1〜3 を実行する。prod も次の `v*` タグ push の前に同じ手順を行う。

1. `terraform apply`（前述「Terraform でインフラ構築」）でバケット `PROJECT_ID-pokemon-snapshot` を作成する。
2. スナップショットを生成する。生成物 (`backend/pokemon-snapshot.json`) はポケモン社の著作物を含むため、公開リポジトリにコミットしない。
   ```bash
   make snapshot-generate
   ```
3. バケットへアップロードする（dev/prod は専用ターゲットを使う）。
   ```bash
   make snapshot-upload-dev
   make snapshot-upload-prod
   ```

各ターゲットの詳細（入力データ・取得範囲など）は `Makefile` を参照。生成スクリプトを再実行するのは、取得範囲（既定 898）を広げるときと、レコードに含める項目を増やすときに限る。

ローカルの real モードで動かす場合は、`POKEMON_SNAPSHOT_URI` にローカルの JSON パス（例: `./pokemon-snapshot.json`）を指定すると Cloud Storage の代わりにそのファイルを読む。

#### 初回デプロイ

初回は Cloud Run サービスがまだ存在しないため、手動でデプロイする。前段の Upstash シークレット投入とスナップショットのアップロードを済ませていないと、起動に失敗する。

```bash
# Artifact Registry への push 用に Docker 認証を設定
gcloud auth configure-docker REGION-docker.pkg.dev

# バックエンド（ビルドコンテキストはリポジトリルート。shared/api-types を含むため）
docker build -f backend/Dockerfile -t REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial .
docker push REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial

# 環境非依存の共通設定は backend/.env.infra、環境ごとの運用値は backend/.env.dev（prod は backend/.env.prod）、
# チューニングパラメーターは backend/.env.tuning を唯一の情報源とする
INFRA_VARS=$(grep -vE '^(#|$)' backend/.env.infra | paste -sd, -)
ENV_VARS=$(grep -vE '^(#|$)' backend/.env.dev | paste -sd, -)
TUNING_VARS=$(grep -vE '^(#|$)' backend/.env.tuning | paste -sd, -)
UPDATE_ENV_VARS="APP_MODE=real"
UPDATE_ENV_VARS="${UPDATE_ENV_VARS},FRONTEND_URL=https://PROJECT_ID.web.app"
UPDATE_ENV_VARS="${UPDATE_ENV_VARS},GOOGLE_CLOUD_PROJECT=PROJECT_ID"
UPDATE_ENV_VARS="${UPDATE_ENV_VARS},POKEMON_SNAPSHOT_URI=gs://PROJECT_ID-pokemon-snapshot/pokemon-snapshot.json"
UPDATE_ENV_VARS="${UPDATE_ENV_VARS},${INFRA_VARS},${ENV_VARS},${TUNING_VARS}"

gcloud run deploy pokelingual-api-dev \
  --image REGION-docker.pkg.dev/PROJECT_ID/pokelingual-backend/api:initial \
  --region asia-northeast1 --project PROJECT_ID \
  --service-account pokelingual-api-dev@PROJECT_ID.iam.gserviceaccount.com \
  --update-secrets "UPSTASH_REDIS_URL=pokelingual-upstash-redis-url:latest" \
  --update-env-vars "${UPDATE_ENV_VARS}" \
  --allow-unauthenticated

# API_BASE_URL を取得して GitHub Variables に設定
gcloud run services describe pokelingual-api-dev --region asia-northeast1 --format 'value(status.url)'
```

以降は `main` への push で dev、`v*` タグ push で prod に自動デプロイされる。後続のデプロイは `.github/workflows/deploy-dev.yml` / `deploy-prod.yml` の定義に従うため、`--max-instances` 等ここにないフラグが追加で付くことがある。

### デプロイワークフローの環境固有値を更新

`.github/workflows/deploy-dev.yml`（dev）と `.github/workflows/deploy-prod.yml`（prod）内の以下の値を自分の環境に合わせて変更:

```yaml
# サービス名（各ファイルの env.SERVICE_NAME）
#   deploy-dev.yml:  pokelingual-api-dev
#   deploy-prod.yml: pokelingual-api-prod
```

## ローカル開発環境

ローカル開発は Google Cloud リソース不要。mock モード（`APP_MODE=mock`）では外部 API（Firebase Auth, PokeAPI, Gemini）の代わりにモック実装を使用し、永続化は Docker 内の Firestore Emulator を使う。CI のテストもこの mock モードで実行しており、AI 呼び出しを伴わないコードの変更やテストの実行はここで完結する。

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
