> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual 固有ルール (overlay)

## [pokelingual] 設計ドキュメント

- 設計レベルの Why を書く先 (共通で ARCHITECTURE.md と表記される先) は、本リポでは `docs/architecture.md` とする

## [pokelingual] 契約型

- backend↔frontend の契約型はリテラルで二重定義せず、SSoT である `shared/api-types` を参照する (共通「所有サービスが発行する API 契約パッケージ」の本リポでの具体化)

## [pokelingual] サービス境界

- backend が Firestore への唯一のアクセス経路であり、自身が所有するデータの SSoT。frontend や外部プロセスは DB へ直接アクセスせず、backend の API 経由で行う
