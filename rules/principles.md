> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual 固有ルール (overlay)

## [pokelingual] backend の後方互換

- backend は常に直近1つ前の frontend と後方互換を保つ (backend → frontend の順で独立してデプロイするため、一時的に backend だけ先のバージョンに進む。ADR-026)
- 契約を壊す変更 (フィールド削除・型変更・必須化など) は一度のリリースに混ぜず、backend を新旧両対応にするリリース → frontend を新契約に切り替えるリリース → backend から旧対応を外すリリース、の複数リリースに分ける
