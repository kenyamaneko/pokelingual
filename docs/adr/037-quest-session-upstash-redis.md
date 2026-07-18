# ADR-037: クエストセッションを Upstash Redis (ローカルは Valkey) へ移す

## ステータス

Accepted (Supersedes ADR-013)

## 結論

クエストセッションを `QuestService` 内のインメモリ `Map` から、`QuestSessionStore` ポートの裏に置いた Redis プロトコルストアへ移す。本番は Upstash Redis (サーバーレス Redis)、ローカル・CI は Valkey に同じ `ioredis` クライアントで接続する。姉妹リポ overload-party の matchmaking / newsfeed が確立した運用パターン (標準 Redis クライアント・ローカル Valkey・Secret Manager の endpoint + password 2 シークレット) を踏襲する。

セッションは get → mutate → set の書き戻しに置き換わり、TTL (既定 3600 秒、`QUEST_SESSION_TTL_SECONDS`) を set のたびに再適用する。Cloud Run はこれによりインスタンス間でセッションを共有できるようになるため、`--max-instances 1` の制約を外す。初回ロールアウトは `--max-instances 1` のまま dev へデプロイして Upstash 配線をスモークで検証し、検証後に別デプロイで `--max-instances 3` へ引き上げる。

## 背景・課題

ADR-013 は「Cloud Run が単一インスタンスのためセッション衝突も起きない」ことを理由にインメモリ管理を採用し、「スケールが必要になった時点で Redis 等への移行を検討する」と将来課題化していた (Issue#201)。

単一インスタンスの制約は 2 つの問題を生む。ユーザー数が増えて `--max-instances 1` では捌けなくなること、そして単一インスタンスでもクエスト進行中 (new → score → guess-name → capture) にインスタンス再起動や新リビジョンへの切り替えが起きると、進行中セッションが失われ 404 になることである。

ADR-013 は Firestore を「ステップごとの往復でレイテンシが高い」として退けていた。Upstash Redis は 1 クエストあたり概ね 9〜14 往復になるが、REST でなく永続 TCP 接続の `ioredis` を使うためコマンドあたりのレイテンシは Firestore より小さく、この基準を満たす。

## 不採用案

- **Firestore**：ADR-013 と同じ理由 (ステップごとの往復レイテンシ) で見送り。今回の要件でも改善しない。
- **Memorystore (Redis)**：マネージド Redis だがサーバーレスでなくアイドルコストが発生する。個人開発の規模に見合わない。
- **Cloud Run のセッションアフィニティ**：ベストエフォートで、インスタンス再起動をまたいだ継続は保証されない。単独では不十分。
- **Upstash Redis の REST SDK (`@upstash/redis`)**：当初案では REST クライアントを検討したが、overload-party の確立パターン (標準 Redis クライアント + ローカル Valkey) に合わせるため、永続 TCP 接続の `ioredis` に差し替えた。ローカル・CI は Valkey に同じコードで接続でき、本番の Redis 経路 (TTL・シリアライズ・`SET` 意味論) をそのまま実行できる。

## Amendment: 2026-07-18 Upstash 接続情報を単一 URL シークレットへ変更

endpoint / password の 2 シークレットは、運用者による手動分解とアプリ側の URL 再構成という二重の変換を要し、二重スキームによる接続障害を招いた。

endpoint / password の 2 シークレットを廃止し、Upstash が発行する接続文字列をそのまま 1 つの `UPSTASH_REDIS_URL` シークレットに格納する構成に変更した。mock モード (ローカル Valkey) の接続設定と形が揃う。overload-party が確立した endpoint + password パターンからは外れる。
