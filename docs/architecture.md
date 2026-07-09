# アーキテクチャ

## 全体像

```
┌──────────────────────┐     ┌──────────────────────────────────────────────────┐
│   Frontend (React)   │     │           Backend (Node.js / Express)             │
│   Firebase Hosting   │     │              Cloud Run                           │
│                      │     │                                                  │
│  LoginPage           │     │  ┌──────────────────────────────────────┐        │
│  QuestPage ──────────┼────►│  │  Router + Middleware                 │        │
│  PokedexPage      │HTTPS│  │  (CORS, Firebase Auth)               │        │
│  SettingsPage        │     │  └──────────┬───────────────────────────┘        │
│                      │     │             │                                    │
│  AuthContext          │     │  ┌──────────▼───────────────────────────┐        │
│  (Firebase Auth SDK) │     │  │  Handlers (HTTP層)                   │        │
│                      │     │  │  quest / pokedex / settings       │        │
└──────────────────────┘     │  └──────────┬───────────────────────────┘        │
                             │             │                                    │
                             │  ┌──────────▼───────────────────────────┐        │
                             │  │  Services (ビジネスロジック)          │        │
                             │  │  QuestService, PokedexService     │        │
                             │  └──────┬───────────┬───────────────────┘        │
                             │         │           │                            │
                             │  ┌──────▼──┐ ┌─────▼──────┐ ┌─────────────┐     │
                             │  │PokeAPI  │ │ Gemini API │ │ Firestore   │     │
                             │  │Fetcher  │ │ Scorer     │ │ Repository  │     │
                             │  └─────────┘ └────────────┘ └─────────────┘     │
                             └──────────────────────────────────────────────────┘
```

## クリーンアーキテクチャ

サービス層はポート（`domain/ports.ts`）に依存し、具象型には依存しない。
これにより、本番実装とモック実装を差し替え可能にしている。

```
Handler（HTTP層）→ Service（ビジネスロジック）→ Domain Ports → Adapter (Repository / 外部API)
```

### ポートと実装の対応

| ポート | 本番実装 | モック実装 |
|---|---|---|
| `PokemonClient` | `PokeAPIClient` | `MockPokemonClient` |
| `LLMClient` | `GeminiClient` | `MockLLMClient` |
| `RandomSource` | `SystemRandomSource` | `MockRandomSource` |
| `UserPokemonRepository` | `UserPokemonRepo` | - (Firestore Emulator 上の本番実装) |
| `UserSettingsRepository` | `UserSettingsRepo` | - (Firestore Emulator 上の本番実装) |
| `RateLimitRepository` | `RateLimitRepo` | - (Firestore Emulator 上の本番実装) |

Repository 層はモックを持たない。ローカル/テスト共に Firestore Emulator 上で本番実装を動かすことで、永続化挙動のドリフトを構造的に排除している。

### 依存性注入

`src/main.ts` が唯一の配線ポイント。`APP_MODE` 環境変数でモードを切り替える:

- **`APP_MODE=mock`** → 外部 API (PokeAPI/Gemini) と認証はモック注入、永続化は Firestore Emulator に接続して本番 Repo を使う
  - `FIRESTORE_EMULATOR_HOST` が未設定なら起動エラー
- **`APP_MODE=real`** → 本番実装を注入

`APP_MODE` は必須。未設定・未知値は起動エラーにして、意図しないモードでの起動を防ぐ。

### 環境変数の使い分け

| 変数名 | 用途 | 値 |
|---|---|---|
| `APP_MODE` | バックエンドのサービス切替（mock vs 実API）。必須 | `mock`（ローカル）/ `real`（Cloud Run） |
| `APP_ENV` | バックエンドの実行環境（開発者除外の適用判定）。定義外の値は起動エラー | `local` / `dev` / `prod` |
| `GEMINI_MODEL` | Gemini のモデル名（real モードでは必須） | deploy.yml が注入 |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | Firestore / Vertex AI の接続先（本番は必須） | deploy.yml が注入 |
| `PER_USER_DAILY_LIMIT` / `GLOBAL_DAILY_LIMIT` | AI 呼び出しの日次上限（本番は必須） | deploy.yml が注入 |
| `MAX_POKEMON_ID` | 出題・図鑑の対象とする図鑑番号の上限（本番は必須） | deploy.yml が注入（mock 既定 898） |
| `VITE_APP_MODE` | フロントエンドのサービス切替（Firebase Auth） | `mock`（ローカル）/ 未設定（デプロイ環境） |
| `VITE_ENVIRONMENT` | UI の環境バッジ表示 | `local` / `dev` / `prod` |

## バックエンド詳細

### レイヤー構成

```
backend/src/
├── main.ts                  # エントリーポイント、DI
├── config/                  # 環境変数 → Config
├── domain/                  # ポート定義・ドメイン型・エラー型（依存の方向の起点）
├── service/                 # ビジネスロジック（Quest, Chat, Pokedex）
├── handler/                 # HTTP リクエスト/レスポンス変換
├── middleware/              # CORS, Firebase Auth, レートリミット
├── adapter/                 # ポートの実装（repository / llm / pokemon / random）
└── router/                  # Express ルーティング定義
```

API 契約型（wire format）は `shared/api-types/*.d.ts` を SSOT とし、backend / frontend の両方が import type する。

### Quest フロー（状態遷移）

クエストセッションはインメモリ（`Map`）で管理。Firestore には永続化しない。

```
0. GET  /api/quest/locations     → 探索場所の候補をランダムに提示（場所選択画面用）
1. GET  /api/quest/new?location= → 選んだ場所のタイプで出題、セッション作成、説明文のポケモン名を伏せ字
2. POST /api/quest/score         → 翻訳を AI がスコアリング（0-100 + 一行レビューコメント）、JA名も伏せ字
3. POST /api/quest/guess-name    → ポケモン名推測（最大3回、EN/JA対応）→ ボール種類決定
   POST /api/quest/skip-guess    → 推測をスキップ → モンスターボール確定
4. POST /api/quest/capture       → シグモイド式（BST + スコア + ボール倍率）で捕獲確率を計算
```

**ポケモン名伏せ字:**
- 出題・スコアリング時：説明文中のポケモン名を代名詞に置換（名前推測のヒント防止）
  - EN："this Pokémon"（単数）/ "of these Pokémon"（複数、前の単語で判定）
  - JA："この ポケモン"
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
- ボール倍率：モンスターボール 1.0x / スーパーボール 2.0x / ハイパーボール 3.0x

**名前当て → ボール種類:**
- 英語名 正解（完全 or ファジー一致、Levenshtein距離 ≤ 2, 名前4文字以上）→ ハイパーボール（ultra, 3.0x）
- 日本語名 正解 → スーパーボール（great, 2.0x）
- スキップ・3回失敗 → モンスターボール（poke, 1.0x）

### PokeAPI データ取得

- 対象：Gen 1-8（ID 1-898、環境変数 `MAX_POKEMON_ID` で指定。mock は既定 898 / real は deploy.yml が注入）
  - #899-905（Legends: Arceus）は対象バージョンに説明文がないため範囲外
  - Gen 9（#906+）は PokeAPI に未収録
- EN/JA 説明文：Gen 6（XY）以降のゲームから取得
  - PokeAPI の `flavor_text_entries` で日本語は Gen 6+ のゲームにのみ存在
- FlavorTextPair：バージョンごとに EN/JA をペアリング、`ja` 優先で `ja-Hrkt` フォールバック
- 重複排除：EN+JA テキストが同一のバージョンは VersionNames をマージ
- タイプ・身長・体重：`/api/v2/pokemon/{id}` の `types`, `height`, `weight` から取得
  - height：デシメートル（4 = 0.4m）、weight：ヘクトグラム（60 = 6.0kg）
  - フロントエンドで /10 変換して m / kg 表示
- 伝説・幻フラグ：`/api/v2/pokemon-species/{id}` の `is_legendary`, `is_mythical` を取得
  - 登場時に特別メッセージ + 背景色変更（伝説=金、幻=紫）
- キャッシュ：`Map` によるインメモリキャッシュ

### 除外ポケモン

除外は 2 系統のロジックを**別々に**持ち、出題抽選と図鑑の両方に適用する。

- **ユーザー設定による除外**：`users/{uid}/settings/preferences.excluded_pokemon_ids`（Firestore）。ユーザーが設定画面で自由に追加・削除でき、次の出題から即反映。全環境で有効。未設定なら除外なし。
- **開発者除外**：コードの固定 ID リスト（開発者が苦手で名前も見たくない 6 匹）。**prod では無効**、それ以外の環境（local/dev）でのみ有効。開発者が非 prod 環境で作業する際の配慮で、システム側が透過的に適用する（設定画面には表示しない）。

適用される除外 = ユーザー設定による除外 ∪ 開発者除外（prod 以外）。`newQuest`（出題抽選）と `getCollection`（図鑑）の両方で除外する。図鑑の分母 `total_available` は変えない（表示エントリのみ除外）。

### 出題世代フィルタ

出題されるポケモンを世代（第 1〜8 世代）で絞り込む per-user 設定。`users/{uid}/settings/preferences.enabled_generations`（Firestore）に保持し、設定画面のチェックボックスで選ぶ。未設定なら全世代。最低 1 世代必須（全解除は不可）。

- **出題プールにのみ適用**：`newQuest` の抽選対象を選択世代の図鑑番号に限定する。**図鑑の母数は変えない**（`getCollection` には適用しない）。
- **抽選機構**：出題プール = 選択世代の図鑑番号から除外 ID を差し引いた集合（`buildQuestPoolIDs`）。図鑑番号の上限（`MAX_POKEMON_ID` / mock の固定リスト）はプール生成では効かせず、抽選時に `getServableIDs()` と突き合わせて一元的に適用する（データソースが実際に出せる番号が上限そのものなので、プール側で二重に上限を持たない）。抽選はサービスが行う：`PokemonClient.getServableIDs()`（データソースが提供できる図鑑番号）と出題プール・場所のタイプ（後述）を突き合わせ、その中からランダムに1匹選ぶ。アダプタは抽選ロジックを持たずデータ提供のみを担う。プールが空（画面が最低1世代・除外上限で防ぐが、設定次第で起こり得る）なら `EmptyQuestPoolError` → 409 で「設定を見直して」と案内する。
- 世代境界は `domain/generation.ts` の `GENERATION_RANGES`（全国図鑑の世代区分）を SSoT とする。

### 探索場所（クエスト入口）

出題の前に探索場所を選ぶ。全10か所（`domain/location.ts` が SSoT、全18タイプを2か所ずつ覆う）から `GET /api/quest/locations` がランダムに4か所を提示し、選んだ場所のタイプで出題を絞る。

- **2段抽選**：まず乱数上位 1%（`LEGENDARY_ENCOUNTER_RATE`）で幻・伝説を判定する。当たれば場所を無視して幻・伝説プール（`domain/legendary.ts` の固定集合）から、外れれば選んだ場所のタイプを持つポケモンから抽選する。幻・伝説プールが選択世代で空ならフォールバックして場所抽選する。
- **世代・除外との合成**：場所・幻伝説のどちらのプールも、世代フィルタ・除外（`buildQuestPoolIDs`）および `getServableIDs()` と交差した上で抽選する（AND）。
- **タイプ→図鑑番号**：`PokemonClient.getIDsByType(type)` が担う。real は PokeAPI の `/type/{name}` をキャッシュ、mock は固定リストをフィルタする。
- **mock の決定性**：`MockRandomSource` は 0 を返すため 1% 判定に当たらず（`>= 1 - RATE` で判定）、場所抽選が決定的に働く。
- **場所定義・幻伝説集合をコードに固定する理由**：`domain/location.ts`（場所→タイプ）と `domain/legendary.ts`（幻・伝説の図鑑番号）は DB を使わずコード上の定数として持つ。いずれも実行時に変化しない静的な参照データ（ゲームの世界設定）で、出題のたびに参照される。DB に置くと出題ごとに読み取りのレイテンシと課金が乗るため、`GENERATION_RANGES` と同じくドメインの定数に置く。内容変更にコード変更とデプロイが要る点がトレードオフで、運用者が画面から編集する要件が出たら設定ファイル化・DB 化を検討する。

### 認証フロー

```
Client → Cloud Run (IAM: allUsers) → CORS middleware → Firebase Auth middleware → Handler
```

- Cloud Run の IAM は `allUsers`（無認証許可）。Firebase Auth トークンは IAM トークンではないため
- アプリレベルの認証は `middleware/auth.ts` が担当
- `allowed_emails`：Firestore `config/auth` ドキュメントから起動時に読み込み
- メールがホワイトリストにない場合は 403
- **`allowed_emails` が空配列・ドキュメント不在の場合は公開モード**（誰でも認証通過後にアクセス可）
  - dev 環境：ホワイトリスト運用、prod 環境：空配列で公開

### コスト管理層（レートリミット）

Gemini API の従量課金が予算（月 5,000円）を超えないよう、AI 呼び出しに2層の日次上限を設ける。
詳細は [ADR-011](adr/011-rate-limiting.md) を参照。

```
Auth middleware → Rate limit middleware → Handler
                       │
                       ▼
                  RateLimitRepo
                  ├ users/{uid}/daily_usage/{YYYY-MM-DD}        → per-user カウンタ
                  └ system/global/daily_usage/{YYYY-MM-DD}      → global カウンタ
```

| 制限 | 値 | 単位 |
|---|---|---|
| 1ユーザー1日あたり | 30回（環境変数 `PER_USER_DAILY_LIMIT`） | AI 呼び出し |
| 全体1日あたり | 1,500回（環境変数 `GLOBAL_DAILY_LIMIT`） | AI 呼び出し |
| リセット時刻 | JST 0:00 | 固定 |

- カウント対象：`/api/quest/score`（Gemini を呼ぶ唯一のエンドポイント）
- グローバル上限を先に判定（混雑時に「混雑」と「あなたが使い切った」を区別可能）
- 上限到達時は HTTP 429 + `kind: "user" | "global"` を返す
- Firestore トランザクションで原子的にチェック+インクリメント
- Gemini モデルは `thinkingBudget: 0` で thinking トークンを無効化（4倍コスト削減）

**Billing Budget アラート（二重防御）:**
- アプリ層レートリミットがバグった時の保険として、Google Cloud Billing Budget で 50/80/100% メール通知
- 自動停止は実装しない（Billing 通知は数時間遅延、アプリ層の上限が実質的な保護）

### ロギング

- 自前の小さなロガー util を通し、Info / Warn / Error の 3 レベル (principles.md のログ方針と 1:1) で出力する
- backend (`backend/src/util/logger.ts`)：`severity` / `message` / `time` + 任意フィールドの 1 行 JSON を stdout (Info) / stderr (Warn/Error) に書き、Cloud Run が Cloud Logging へ自動転送する。JSON は構造化フィールドとして取り込まれ、severity での絞り込みとフィールド検索ができる。可変値は message に埋め込まず fields に分離する（message を固定文字列に保ち検索性を確保するため）
- frontend (`frontend/src/utils/logger.ts`)：収集基盤が無くブラウザ devtools でしか見ないため、JSON 文字列化はせず console に message + fields のまま渡す（ツリー展開・スタックトレース表示を保つ）
- 既製ロガー (pino 等) を使わない理由：3 レベル・十数箇所という規模に対し、依存ゼロで全挙動を単体テストで固定できることを優先した（裁定は Issue #14）
- リクエストログは実装しない（Cloud Run が標準で出力するため）

## フロントエンド詳細

### 構成

```
frontend/src/
├── pages/                  # ルートに対応するページコンポーネント
│   ├── LoginPage.tsx       # ログイン（Google + メール/パスワード）、問い合わせ/利用規約リンク
│   ├── SignupPage.tsx      # 新規登録
│   ├── ResetPasswordPage.tsx # パスワードリセット
│   ├── QuestPage.tsx       # クエストフロー（状態機械は useQuest に委譲）
│   ├── PokedexPage.tsx  # 捕獲済みポケモン一覧
│   ├── SettingsPage.tsx    # 出題世代・除外ポケモン設定、問い合わせ/利用規約リンク、ログアウト
│   ├── TermsPage.tsx       # 利用規約（非営利ファンサイト明記。/terms 公開ルート）
│   ├── NotFoundPage.tsx    # 404
│   └── HomePage.tsx
├── components/
│   ├── quest/              # LocationSelect, QuestCard, TranslationInput, ScoreDisplay, NameGuess, CaptureResult, RateLimitModal
│   ├── pokedex/         # PokemonGrid, PokemonDetailCard
│   ├── layout/             # Header, ProtectedRoute
│   └── auth/               # GoogleLogo
├── contexts/
│   ├── AuthContext.tsx      # Firebase Auth の状態管理
│   ├── DevAuthContext.tsx   # dev モード用モック認証
│   └── UsageContext.tsx     # 当日利用状況の購読 + レート制限モーダル表示
├── hooks/
│   └── useQuest.ts         # クエストの状態機械 + API 呼び出し
├── api/                    # API クライアント（axios ベース）
│   ├── client.ts           # axios インスタンス（Auth トークン自動付与、429 通知）
│   ├── questApi.ts / pokedexApi.ts / settingsApi.ts / usageApi.ts
├── utils/                  # 表示整形・タイプ色・レート制限イベントハブ
└── firebase.ts             # Firebase 初期化、isDevMode 判定
```

API 契約型は `shared/api-types/*.d.ts`（SSOT）を import type する（frontend 内に契約型定義は持たない）。

### 認証

- `AuthContext` が Firebase Auth の `onAuthStateChanged` を監視
- `api/client.ts` の axios インターセプターが全リクエストに `Authorization: Bearer <idToken>` を付与
- `ProtectedRoute` がログイン状態を確認し、未認証なら `/login` へリダイレクト
- dev モードでは `DevAuthContext` がモックユーザーを提供（Firebase 接続不要）

### QuestPage の状態遷移（useQuest）

```
selectLocation → loading → translating → guessing → capturing → result   （失敗時は error）
```

各フェーズで対応する API を呼び出し、レスポンスに応じて次のフェーズに遷移。`selectLocation` で場所候補を取得し、場所を選ぶと `loading`（出題取得）へ進む。「次のポケモンを探す」は `selectLocation` に戻る。

## インフラ

### Google Cloud リソース（Terraform 管理）

| リソース | 用途 |
|---|---|
| Firebase Project + Web App | フロントエンドホスティング + 認証 |
| Firestore | ユーザーデータ（`users/{uid}/pokemon/{id}`） |
| Identity Platform | メール/パスワード認証 |
| Artifact Registry | Docker イメージ保管 |
| Vertex AI | Gemini（ADC 認証、API キー不要） |
| WIF Pool + Provider | GitHub Actions → Google Cloud 認証（JSON キー不要） |
| Cloud Monitoring | 5xx アラート、レイテンシアラート、エラーログアラート |
| Billing Budget | 月次予算アラート（50/80/100% でメール通知） |

**Cloud Run は Terraform 管理外**。GitHub Actions の `gcloud run deploy` が作成・更新する。

### Firestore データ構造

```
config/
  auth                          # { allowed_emails: ["email1", "email2"] }

users/
  {uid}/
    pokemon/
      {pokemon_id}              # { pokemon_id, name_en, name_ja, sprite_url, score, status, ... }
    settings/
      preferences               # { excluded_pokemon_ids: [...], enabled_generations: [1, 2, ...] }
    daily_usage/
      {YYYY-MM-DD}              # { count, updated_at } — per-user レートリミットカウンタ

system/
  global/
    daily_usage/
      {YYYY-MM-DD}              # { count, updated_at } — global レートリミットカウンタ
```

### 環境

| 環境 | Google Cloud Project | ブランチ | フロントエンド | バックエンド |
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
push → ci.yml（テスト・lint） → deploy-backend + deploy-frontend + deploy-behavior-catalog（並列）
```

結合テスト（dev のみ）: デプロイ済み Cloud Run に対して実際の API リクエスト。
Firebase Auth テストユーザーを自動作成し、テスト後に全リソースをクリーンアップ。

振る舞いカタログ: テスト済みの振る舞いを一覧できる仕様ドキュメント。PR では job summary に出力し、main では GitHub Pages に公開する。
