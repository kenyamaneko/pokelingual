# ADR-001: クリーンアーキテクチャの採用

## ステータス

採用済み

## コンテキスト

バックエンドは複数の外部サービス（PokeAPI, Gemini API, Firestore, Firebase Auth）に依存する。
ローカル開発時にこれらすべてを起動するのは現実的ではなく、テスト時にも外部依存を排除したい。

## 決定

サービス層がインターフェース（`domain/interfaces.go`）に依存し、具象型に直接依存しないクリーンアーキテクチャを採用する。

主要インターフェース:
- `PokemonFetcher` — ポケモンデータ取得
- `AIScorer` — 翻訳スコアリング
- `UserPokemonRepository` — 捕獲データ永続化
- `UserSettingsRepository` — ユーザー設定

`cmd/server/main.go` で `APP_MODE` に応じて実装を注入する。

## 結果

- ローカル開発: devmock 実装で外部依存なしに動作
- テスト: testutil のモックで高速な単体テスト
- 本番: 実装を差し替えるだけで AI バックエンドの変更が可能（Gemini → Claude 等）
- 配線が `main.go` に集約され、依存関係が明示的
