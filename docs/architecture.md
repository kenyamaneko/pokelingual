# アーキテクチャ

## 全体像

```
┌──────────────────────┐     ┌──────────────────────────────────────────────────┐
│   Frontend (React)   │     │           Backend (Node.js / Express)             │
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

サービス層はインターフェース（`domain/interfaces.ts`）に依存し、具象型には依存しない。
これにより、本番実装とモック実装を差し替え可能にしている。

```
Handler（HTTP層）→ Service（ビジネスロジック）→ Domain Interfaces → Repository / 外部API
```

### インターフェースと実装の対応

| インターフェース | 本番実装 | devmock | テスト用 |
|---|---|---|---|
| `PokemonFetcher` | `PokeAPIService` | `MockPokemonFetcher` | - |
| `AIScorer` | `GeminiService` | `MockAIScorer` | - |
| `UserPokemonRepository` | `UserPokemonRepo` | `MockUserPokemonRepo` | - |
| `UserSettingsRepository` | `UserSettingsRepo` | `MockUserSettingsRepo` | - |

### 依存性注入

`src/main.ts` が唯一の配線ポイント。`APP_MODE` 環境変数でモードを切り替える:

- **`APP_MODE=mock`** → devmock 実装を注入（外部API不要、認証スキップ）
- **`APP_MODE=prod`**（デフォルト以外）→ 本番実装を注入

### 環境変数の使い分け

| 変数名 | 用途 | 値 |
|---|---|---|
| `APP_MODE` | バックエンドのサービス切替（mock vs 実API） | `mock`（ローカル）/ `prod`（Cloud Run） |
| `VITE_APP_MODE` | フロントエンドのサービス切替（Firebase Auth） | `mock`（ローカル）/ 未設定（デプロイ環境） |
| `VITE_ENVIRONMENT` | UI の環境バッジ表示 | `local` / `dev` / `prod` |

## バックエンド詳細

### レイヤー構成

```
backend/src/
├── main.ts                  # エントリーポイント、DI
├── config/                  # 環境変数 → Config
├── types/                   # 型定義（Pokemon, Quest, UserPokemon 等）
├── domain/                  # インターフェース定義（依存の方向の起点）
├── handler/                 # HTTP リクエスト/レスポンス変換
├── middleware/              # CORS, Firebase Auth
├── repository/              # Firestore 実装
├── router/                  # Express ルーティング定義
├── service/                 # PokeAPI, Gemini, Quest, Collection
├── apperror/                # アプリケーション固有エラー型
└── devmock/                 # ローカル開発用モック
```

### Quest フロー（状態遷移）

クエストセッションはインメモリ（`Map`）で管理。Firestore には永続化しない。

```
1. GET  /api/quest/new        → ランダムポケモン取得、セッション作成、説明文のポケモン名を伏せ字
2. POST /api/quest/score      → 翻訳を AI がスコアリング（0-100 + 一行レビューコメント）、JA名も伏せ字
3. POST /api/quest/guess-name → ポケモン名推測（最大3回、EN/JA対応）→ ボール種類決定
4. POST /api/quest/capture    → シグモイド式（BST + スコア + ボール倍率）で捕獲確率を計算
5. POST /api/quest/chat       → 博士に質問（捕獲後、フロントエンドからコンテキスト+履歴を送信）
```

**博士チャット:**
- 捕獲結果画面から「博士に 質問」ボタンでモーダルを開く
- フロントエンドがステートレスにコンテキスト（原文、翻訳、スコア、レビュー、ポケモン名）+ メッセージ履歴を毎回送信
- `domain.AIScorer` インターフェースの `Chat` メソッドで実装（Gemini/モック差し替え可能）
- セッションは `AttemptCapture` で削除済みのため、チャットはセッション不参照

**ポケモン名伏せ字:**
- 出題・スコアリング時: 説明文中のポケモン名を代名詞に置換（名前推測のヒント防止）
  - EN: "this Pokémon"（単数）/ "of these Pokémon"（複数、前の単語で判定）
  - JA: "この ポケモン"
- AI スコアリングには元テキストを使用（採点精度に影響なし）
- 捕獲結果・コレクションでは元の名前を表示

**捕獲確率の計算（シグモイド式）:**
```
X = BST / 100,  S = score / 100
logit = 2.5 - 0.34X - 0.17X² + 14.5S - 4.2XS + 0.52X²S
captureRate = clamp(sigmoid(logit) × ballMultiplier, 0, 1)
```
- 種族値（BST）が高いポケモンほど捕まえにくい
- スコア90 + スーパーボールなら伝説ポケモン（BST 680）でもほぼ確実に捕獲可能
- ボール倍率: モンスターボール 1.0x / スーパーボール 2.0x / ハイパーボール 3.0x

**名前当て → ボール種類:**
- 英語名 正解（完全 or ファジー一致、Levenshtein距離 ≤ 2, 名前4文字以上）→ ハイパーボール（ultra, 3.0x）
- 日本語名 正解 → スーパーボール（great, 2.0x）
- スキップ・3回失敗 → モンスターボール（poke, 1.0x）

### PokeAPI データ取得

- 対象: Gen 1-8（ID 1-898、Firestore `config/app.max_pokemon_id` で管理）
  - #899-905（Legends: Arceus）は対象バージョンに説明文がないため範囲外
  - Gen 9（#906+）は PokeAPI に未収録
- EN/JA 説明文: Gen 6（XY）以降のゲームから取得
  - PokeAPI の `flavor_text_entries` で日本語は Gen 6+ のゲームにのみ存在
- FlavorTextPair: バージョンごとに EN/JA をペアリング、`ja` 優先で `ja-Hrkt` フォールバック
- 重複排除: EN+JA テキストが同一のバージョンは VersionNames をマージ
- タイプ・身長・体重: `/api/v2/pokemon/{id}` の `types`, `height`, `weight` から取得
  - height: デシメートル（4 = 0.4m）、weight: ヘクトグラム（60 = 6.0kg）
  - フロントエンドで /10 変換して m / kg 表示
- 伝説・幻フラグ: `/api/v2/pokemon-species/{id}` の `is_legendary`, `is_mythical` を取得
  - 登場時に特別メッセージ + 背景色変更（伝説=金、幻=紫）
- キャッシュ: `Map` によるインメモリキャッシュ

### 除外ポケモン

ユーザーごとに設定可能。`UserSettingsRepository` 経由で `users/{uid}/settings/preferences` に保存。

- ユーザーが未設定の場合、`config/app.default_excluded_pokemon_ids` のデフォルト値を使用
- デフォルト: クモ系6匹（#167, #168, #595, #596, #751, #752）
- ユーザーは設定画面から自由に追加・削除可能

### 認証フロー

```
Client → Cloud Run (IAM: allUsers) → CORS middleware → Firebase Auth middleware → Handler
```

- Cloud Run の IAM は `allUsers`（無認証許可）。Firebase Auth トークンは IAM トークンではないため
- アプリレベルの認証は `middleware/auth.ts` が担当
- `allowed_emails`: Firestore `config/auth` ドキュメントから起動時に読み込み
- メールがホワイトリストにない場合は 403

### ロギング

- `console.log` / `console.error` で出力（Cloud Run が Cloud Logging に自動転送）

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
│   ├── quest/              # QuestCard, TranslationInput, ScoreDisplay, NameGuess, CaptureResult, ProfessorChat
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
| Vertex AI | Gemini（ADC 認証、API キー不要） |
| WIF Pool + Provider | GitHub Actions → GCP 認証（JSON キー不要） |
| Cloud Monitoring | 5xx アラート、レイテンシアラート、エラーログアラート |

**Cloud Run は Terraform 管理外** — GitHub Actions の `gcloud run deploy` が作成・更新。

### Firestore データ構造

```
config/
  auth                          # { allowed_emails: ["email1", "email2"] }
  app                           # { max_pokemon_id: 898, default_excluded_pokemon_ids: [167, 168, ...] }

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
