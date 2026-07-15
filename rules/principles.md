> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual 固有ルール (overlay)

## [pokelingual] 設計ドキュメント

- 設計上のトレードオフによる Why (ADR) は `docs/adr/` に、仕様・業務ルールとしての Why (BDR) は `docs/bdr/` に置く

## [pokelingual] 契約型

- backend↔frontend の契約型はリテラルで二重定義せず、SSoT である `shared/api-types` を参照する (共通「所有サービスが発行する API 契約パッケージ」の本リポでの具体化)

## [pokelingual] サービス境界

- backend が Firestore への唯一のアクセス経路であり、自身が所有するデータの SSoT。frontend や外部プロセスは DB へ直接アクセスせず、backend の API 経由で行う

## [pokelingual] backend の後方互換

- backend は常に直近1つ前の frontend と後方互換を保つ (backend → frontend の順で独立してデプロイするため、一時的に backend だけ先のバージョンに進む。ADR-026)
- 契約を壊す変更 (フィールド削除・型変更・必須化など) は一度のリリースに混ぜず、backend を新旧両対応にするリリース → frontend を新契約に切り替えるリリース → backend から旧対応を外すリリース、の複数リリースに分ける
