# ADR-007: クリーンアーキテクチャの採用

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

## Amendment: 2026-05-30 Repository 層はモックを持たず Firestore Emulator に一本化

Repository 層（Firestore アクセス）のインメモリモックを廃止し、ローカル/テスト共に Firestore Emulator 上で本番実装（Repo）を動かす方式に一本化した。インメモリモックは Firestore のセマンティクス（パスの妥当性、Date/Timestamp の扱い）と実装が乖離しやすく、Emulator を使った contract test と二重管理になっていたため。

- `APP_MODE=mock` では外部 API（PokeAPI/Gemini）と認証のみモック注入し、永続化は Firestore Emulator + 本番 Repo を使う（`FIRESTORE_EMULATOR_HOST` が未設定なら起動エラー）。
- `APP_MODE=real` では本番実装を注入する。
- `APP_MODE` は必須の環境変数とし、未設定・未知値は起動エラーにして意図しないモードでの起動を防ぐ。
