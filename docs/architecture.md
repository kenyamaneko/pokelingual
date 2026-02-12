# アーキテクチャ

## 全体像

```
┌──────────────────────┐     ┌──────────────────────────────────────────────────┐
│   Frontend (React)   │     │              Backend (Go / Gin)                  │
│   Firebase Hosting   │     │              Cloud Run                           │
│                      │     │                                                  │
│  LoginPage           │     │  ┌──────────────────────────────────────┐        │
│  QuestPage ──────────┼────►│  │  Router + Middleware                 │        │
│  CollectionPage      │HTTPS│  │  (CORS, Firebase Auth)               │        │
│  SettingsPage        │     │  └──────────┬───────────────────────────┘        │
│                      │     │             │                                    │
│  AuthContext          │     │  ┌──────────▼───────────────────────────┐        │
│  (Firebase Auth SDK) │     │  │  Handlers (HTTP層)                   │        │
│                      │     │  │  quest / collection / settings       │        │
└──────────────────────┘     │  └──────────┬───────────────────────────┘        │
                             │             │                                    │
                             │  ┌──────────▼───────────────────────────┐        │
                             │  │  Services (ビジネスロジック)          │        │
                             │  │  QuestService, CollectionService     │        │
                             │  └──────┬───────────┬───────────────────┘        │
                             │         │           │                            │
                             │  ┌──────▼──┐ ┌─────▼──────┐ ┌─────────────┐     │
                             │  │PokeAPI  │ │ Gemini API │ │ Firestore   │     │
                             │  │Fetcher  │ │ Scorer     │ │ Repository  │     │
                             │  └─────────┘ └────────────┘ └─────────────┘     │
                             └──────────────────────────────────────────────────┘
```

## クリーンアーキテクチャ

サービス層はインターフェース（`domain/interfaces.go`）に依存し、具象型には依存しない。
これにより、本番実装とモック実装を差し替え可能にしている。

```
Handler（HTTP層）→ Service（ビジネスロジック）→ Domain Interfaces → Repository / 外部API
```

### インターフェースと実装の対応

| インターフェース | 本番実装 | devmock | テスト用 |
|---|---|---|---|
| `PokemonFetcher` | `PokeAPIService` | `devmock.PokemonFetcher` | `testutil.MockPokemonFetcher` |
| `AIScorer` | `GeminiService` | `devmock.AIScorer` | `testutil.MockAIScorer` |
| `UserPokemonRepository` | `repository.UserPokemonRepo` | `devmock.UserPokemonRepo` | `testutil.MockUserPokemonRepo` |
| `UserSettingsRepository` | `repository.UserSettingsRepo` | `devmock.UserSettingsRepo` | `testutil.MockUserSettingsRepo` |

### 依存性注入

`cmd/server/main.go` が唯一の配線ポイント。`APP_MODE` 環境変数でモードを切り替える:

- **`APP_MODE=dev`** → devmock 実装を注入（外部API不要、認証スキップ）
- **`APP_MODE=prod`**（デフォルト以外）→ 本番実装を注入

## バックエンド詳細

### レイヤー構成

```
backend/
├── cmd/server/main.go       # エントリーポイント、DI
├── internal/
│   ├── config/              # 環境変数 → Config struct
│   ├── domain/              # インターフェース定義（依存の方向の起点）
│   ├── handler/             # HTTP リクエスト/レスポンス変換
│   ├── middleware/           # CORS, Firebase Auth
│   ├── model/               # データ構造体（Pokemon, Quest, UserPokemon 等）
│   ├── repository/          # Firestore 実装
│   ├── router/              # Gin ルーティング定義
│   ├── service/             # PokeAPI, Gemini, Quest, Collection
│   ├── apperror/            # アプリケーション固有エラー型
│   ├── devmock/             # ローカル開発用モック
│   └── testutil/            # テスト用モック
```

### Quest フロー（状態遷移）

クエストセッションはインメモリ（`sync.Map`）で管理。Firestore には永続化しない。

```
1. GET  /api/quest/new        → ランダムポケモン取得、セッション作成
2. POST /api/quest/score      → 翻訳を AI がスコアリング（0-100 + 一行レビューコメント）
3. POST /api/quest/guess-name → ポケモン名推測（最大3回、EN/JA対応）
4. POST /api/quest/capture    → スコア × 名前ボーナス × ミスペナルティ → 捕獲確率
```

**捕獲確率の計算:**
```
probability = (score / 100) × name_multiplier × guess_penalty
name_multiplier: 1.5 (EN正解) / 1.0 (JA正解) / 0.5 (不正解)
guess_penalty:   1.0 - wrong_guesses × 0.05
上限: 1.0
```

**名前マッチング:**
- 英語: 完全一致 → multiplier 1.5
- 英語: ファジー一致（Levenshtein距離 ≤ 2, 名前4文字以上） → multiplier 1.5
- 日本語: 完全一致 → multiplier 1.0
- 3回不正解 → multiplier 0.5、名前を公開

### PokeAPI データ取得

- 対象: Gen 1-8（ID 1-898、Firestore `config/app.max_pokemon_id` で管理）
  - #899-905（Legends: Arceus）は対象バージョンに説明文がないため範囲外
  - Gen 9（#906+）は PokeAPI に未収録
- EN/JA 説明文: Gen 6（XY）以降のゲームから取得
  - PokeAPI の `flavor_text_entries` で日本語は Gen 6+ のゲームにのみ存在
- FlavorTextPair: バージョンごとに EN/JA をペアリング、`ja` 優先で `ja-Hrkt` フォールバック
- 重複排除: EN+JA テキストが同一のバージョンは VersionNames をマージ
- キャッシュ: `sync.Map` によるインメモリキャッシュ

### 除外ポケモン

2段階の除外:
1. **グローバル除外**（全ユーザー共通）: クモ系6匹（#167, #168, #595, #596, #751, #752）
2. **ユーザー設定除外**: `UserSettingsRepository` 経由で個別管理

### 認証フロー

```
Client → Cloud Run (IAM: allUsers) → CORS middleware → Firebase Auth middleware → Handler
```

- Cloud Run の IAM は `allUsers`（無認証許可）。Firebase Auth トークンは IAM トークンではないため
- アプリレベルの認証は `middleware/auth.go` が担当
- `allowed_emails`: Firestore `config/auth` ドキュメントから起動時に読み込み
- メールがホワイトリストにない場合は 403

### ロギング

- `APP_MODE=prod` 時: `slog` の JSON ハンドラーで Cloud Logging 互換形式に変換
  - `level` → `severity`（Cloud Logging が認識するフィールド名）
  - `msg` → `message`
  - WARN → `WARNING`, ERROR → `ERROR`（Cloud Logging 形式の値）

## フロントエンド詳細

### 構成

```
frontend/src/
├── pages/                  # ルートに対応するページコンポーネント
│   ├── LoginPage.tsx       # メール/パスワードログイン
│   ├── QuestPage.tsx       # クエストフロー（6フェーズの状態機械）
│   ├── CollectionPage.tsx  # 捕獲済みポケモン一覧
│   ├── SettingsPage.tsx    # 除外ポケモン設定、ログアウト
│   └── HomePage.tsx
├── components/
│   ├── quest/              # QuestCard, TranslationInput, ScoreDisplay, NameGuess, CaptureResult
│   ├── collection/         # PokemonGrid, PokemonDetailCard
│   └── layout/             # Header, ProtectedRoute
├── contexts/
│   ├── AuthContext.tsx      # Firebase Auth の状態管理
│   └── DevAuthContext.tsx   # dev モード用モック認証
├── services/               # API クライアント（axios ベース）
│   ├── api.ts              # axios インスタンス（Auth トークン自動付与）
│   ├── questApi.ts
│   ├── collectionApi.ts
│   └── settingsApi.ts
├── config/firebase.ts      # Firebase 初期化、isDevMode 判定
└── types/index.ts          # TypeScript 型定義
```

### 認証

- `AuthContext` が Firebase Auth の `onAuthStateChanged` を監視
- `api.ts` の axios インターセプターが全リクエストに `Authorization: Bearer <idToken>` を付与
- `ProtectedRoute` がログイン状態を確認し、未認証なら `/login` へリダイレクト
- dev モードでは `DevAuthContext` がモックユーザーを提供（Firebase 接続不要）

### QuestPage の状態遷移

```
loading → quest → translating → scoring → guessing → result
```

各フェーズで対応する API を呼び出し、レスポンスに応じて次のフェーズに遷移。

## インフラ

### GCP リソース（Terraform 管理）

| リソース | 用途 |
|---|---|
| Firebase Project + Web App | フロントエンドホスティング + 認証 |
| Firestore | ユーザーデータ（`users/{uid}/pokemon/{id}`） |
| Identity Platform | メール/パスワード認証 |
| Artifact Registry | Docker イメージ保管 |
| Secret Manager | Gemini API キー |
| WIF Pool + Provider | GitHub Actions → GCP 認証（JSON キー不要） |
| Cloud Monitoring | 5xx アラート、レイテンシアラート、エラーログアラート |

**Cloud Run は Terraform 管理外** — GitHub Actions の `gcloud run deploy` が作成・更新。

### Firestore データ構造

```
config/
  auth                          # { allowed_emails: ["email1", "email2"] }
  app                           # { max_pokemon_id: 898 }

users/
  {uid}/
    pokemon/
      {pokemon_id}              # { pokemon_id, name_en, name_ja, sprite_url, score, status, ... }
    settings/
      preferences               # { excluded_pokemon_ids: [167, 168, ...] }
```

### 環境

| 環境 | GCP Project | ブランチ | フロントエンド | バックエンド |
|---|---|---|---|---|
| dev | `pokelingual-dev` | `develop` | Firebase Hosting | Cloud Run |
| prod | `pokelingual-prod` | `main` | Firebase Hosting | Cloud Run |

### CI/CD パイプライン

**develop ブランチ（dev 環境）:**
```
push → ci.yml（テスト・lint） → deploy-backend → integration-test → deploy-frontend
                                                      ↓ (失敗時)
                                                  自動ロールバック
```

**main ブランチ（prod 環境）:**
```
push → ci.yml（テスト・lint） → deploy-backend + deploy-frontend（並列）
```

結合テスト（dev のみ）: デプロイ済み Cloud Run に対して実際の API リクエスト。
Firebase Auth テストユーザーを自動作成し、テスト後に全リソースをクリーンアップ。
