# ADR-001: クリーンアーキテクチャの採用

## ステータス

Accepted

## 結論

外部サービスへの依存を差し替え可能にし、ローカル開発とテストを外部依存なしで回すため、サービス層はインターフェース（`domain/interfaces.go`）に依存させ、具象型に直接依存させない。`cmd/server/main.go` が `APP_MODE` に応じて実装を注入する。devmock やモックで外部サービスなしに動作し、本番実装を差し替えるだけで AI バックエンドを変更できる（Gemini から Claude 等）。

## 背景・課題

バックエンドは複数の外部サービス（PokeAPI, Gemini API, Firestore, Firebase Auth）に依存する。ローカル開発時にこれらすべてを起動するのは現実的でなく、テスト時にも外部依存を排除したい。

## 詳細

主要インターフェース：

- `PokemonFetcher`：ポケモンデータ取得
- `AIScorer`：翻訳スコアリング
- `UserPokemonRepository`：捕獲データ永続化
- `UserSettingsRepository`：ユーザー設定

`APP_MODE` で devmock 実装（外部依存なし）、testutil のモック（単体テスト）、本番実装を切り替える。
