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
| [運用手順書](docs/ops/) | prod ロールバック・アラート対応と緊急停止・Firestore バックアップ復旧の手順 |
| [トラブルシューティング](docs/ops/troubleshooting.md) | 開発中に遭遇した問題と解決策 |
| [テスト観点カタログ](https://kenyamaneko.github.io/pokelingual/) | テスト名から自動生成したテスト済みの観点一覧。外から見た振る舞いと内部の挙動に分けて掲載（main の CI が更新） |
| [テストカバレッジ（backend）](https://kenyamaneko.github.io/pokelingual/coverage/backend/) | backend のテストカバレッジレポート（main の CI が更新） |
| [テストカバレッジ（frontend）](https://kenyamaneko.github.io/pokelingual/coverage/frontend/) | frontend のテストカバレッジレポート（main の CI が更新） |

## ディレクトリ構成

```
├── backend/
│   ├── src/
│   │   ├── config/          # 環境変数の読み込み
│   │   ├── domain/          # ドメインロジック、インターフェース定義
│   │   ├── handler/         # HTTP ハンドラー
│   │   ├── middleware/      # 認証、レート制限
│   │   ├── adapter/         # Firestore・PokeAPI・Gemini 実装
│   │   ├── router/          # ルーティング定義
│   │   ├── service/         # ビジネスロジック（Quest, Pokedex）
│   │   └── util/            # ロガー等の共通ユーティリティ
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # ページコンポーネント
│   │   ├── components/      # 共通コンポーネント
│   │   ├── contexts/        # AuthContext, DevAuthContext
│   │   ├── hooks/           # カスタムフック
│   │   ├── api/             # バックエンド API クライアント
│   │   └── firebase.ts      # Firebase 設定
│   └── Dockerfile.dev
├── shared/api-types/        # backend↔frontend API 契約型 (SSoT)
├── terraform/               # Google Cloud インフラ（dev/prod）
├── scripts/                 # デプロイ後スモーク・テスト観点カタログ生成スクリプト
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

real モードの backend は起動時に、非公開の Cloud Storage バケットからポケモンの種別データのスナップショットを読み込む（ADR-022）。スナップショットが未配置だと起動に失敗するため、backend をデプロイする前に次を済ませておく。`main` への push は dev へ自動デプロイされるので、この変更をマージする前に dev で 1〜3 を実行する。prod も次の `v*` タグ push の前に同じ手順を行う。

1. `terraform apply`（前述「Terraform でインフラ構築」）でバケット `PROJECT_ID-pokemon-snapshot` を作成する。
2. `PokeAPI/api-data` のローカルクローンからスナップショットを生成する。生成物はポケモン社の著作物を含むため、公開リポジトリにコミットしない（BDR-007）。
   ```bash
   git clone --depth 1 https://github.com/PokeAPI/api-data.git
   cd backend
   npm run generate-snapshot -- --api-data ../api-data --out pokemon-snapshot.json
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
push → CI 再実行 ┬→ バックエンドデプロイ → デプロイ後スモーク・フロントエンドデプロイ → dev E2E
                └→ カタログ生成テスト → テスト観点カタログ/カバレッジ公開
```

デプロイ後スモークは、デプロイ済み Cloud Run にヘルスと認証付き read を 1 本ずつ叩く検出専用（書き込みなし・自動ロールバックなし、ADR-015）。

### タグ `v*`（prod 環境）

```
tag → バックエンドデプロイ（同一コミットを prod へ再ビルド・再テストなし） → フロントエンドデプロイ
```

テスト観点カタログはテスト済みの観点を「外から見た振る舞い」「内部の挙動」に分けて一覧できる仕様ドキュメントで、`main` マージ時点の仕様として [GitHub Pages](https://kenyamaneko.github.io/pokelingual/) に公開する。テストカバレッジも同じタイミングで [backend](https://kenyamaneko.github.io/pokelingual/coverage/backend/) / [frontend](https://kenyamaneko.github.io/pokelingual/coverage/frontend/) 別ページとして公開し、直近の品質状況を追えるようにする。

### ワークフロー

| ファイル | トリガー | 内容 |
|---------|---------|------|
| `ci.yml` | PR, workflow_call | バックエンド/フロントエンドテスト・lint・型チェック、E2E、Terraform fmt |
| `deploy-dev.yml` | push to `main` | CI 再実行 → dev デプロイ → スモーク・dev E2E｜並行でカタログ生成テスト → テスト観点カタログ/カバレッジ公開 |
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

リリース後に不具合が発覚したときの切り戻しは[ロールバック手順](docs/ops/rollback-prod.md)に従う。

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
terraform init -backend-config=environments/dev/backend.gcs.tfbackend -reconfigure
terraform apply -var-file=environments/dev/terraform.tfvars

terraform init -backend-config=environments/prod/backend.gcs.tfbackend -reconfigure
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
