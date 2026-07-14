# ADR-029: 自前ロガーを採用し pino 等の既製ロガーは使わない

## ステータス

Accepted

## 結論

Info / Warn / Error の 3 レベルのみを扱う自前の小さなロガー util を backend / frontend にそれぞれ導入し、pino 等の既製ロガーは使わない。

- backend（`backend/src/util/logger.ts`）：`severity` / `message` / `time` + 任意フィールドの 1 行 JSON を stdout（Info）/ stderr（Warn/Error）に書く。Cloud Run がこれを Cloud Logging へ自動転送し、JSON は構造化フィールドとして取り込まれるため severity での絞り込みとフィールド検索ができる。可変値は message に埋め込まず fields に分離し、message を固定文字列に保つことで検索性を確保する。
- frontend（`frontend/src/utils/logger.ts`）：収集基盤がなくブラウザ devtools でしか見ないため、JSON 文字列化はせず console に message + fields のまま渡す（ツリー展開・スタックトレース表示を保つ）。

## 背景・課題

ログサイトは十数箇所、レベルも Info/Warn/Error の 3 段のみという小規模だった。この規模に pino 等の既製ロガーを導入すると、フォーマット・トランスポート設定などの依存が増える。依存ゼロで全挙動を単体テストで固定できることを優先した（裁定は Issue #14）。

## 詳細

- リクエストログは実装しない（Cloud Run が標準で出力するため）。
- 予約キー（`severity` / `message` / `time`）を fields で上書きしようとした場合はエラーにする。

## 不採用案

- **pino 等の既製ロガーを導入する**：3 レベル・十数箇所という規模に対して過剰。フォーマット・トランスポート等の設定コストが乗り、依存ゼロで単体テストが全挙動を固定できる利点を失う。
