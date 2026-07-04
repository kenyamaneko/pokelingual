> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual 固有ルール (overlay)

共通ルール (`keyandnotes-rules` の `rules/principles.md`) を土台に、pokelingual 固有の具体化を定義する。本ファイルは CLAUDE.md から共通ルールに続けて @import される。共通と衝突する場合は本ファイルを優先する (共通 principles「[base] ルールの階層と優先順位」)。

## [pokelingual] 設計ドキュメント

- 設計レベルの Why を書く先 (共通で ARCHITECTURE.md と表記される先) は、本リポでは `docs/architecture.md` とする

## [pokelingual] 契約型

- backend↔frontend の契約型はリテラルで二重定義せず、SSoT である `shared/api-types` を参照する (共通「所有サービスが発行する API 契約パッケージ」の本リポでの具体化)

## [pokelingual] サービス境界

- backend が Firestore への唯一のアクセス経路であり、自身が所有するデータの SSoT。frontend や外部プロセスは DB へ直接アクセスせず、backend の API 経由で行う
