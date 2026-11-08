> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual 固有ルール (overlay)

## [pokelingual] ブランチ戦略とデプロイ

- ブランチ戦略は keyandnotes-rules の GitHub Flow に従う
- デプロイ戦略は keyandnotes-rules の Merge → Dev, Tag → Prod に従う
- main へのマージで dev にデプロイし、「Deploy to Prod」の手動実行で prod にデプロイする

## [pokelingual] バージョニング

- 版は Git タグ `vX.Y.Z` で示す。「Deploy to Prod」で選んだバージョンアップの種類から CI が打ち、そのタグのコミットを prod にデプロイする
- 上げ方は keyandnotes-rules のバージョニングとCI方針に従う

## [pokelingual] ブランチ保護 (GitHub Rulesets)

- main へのマージに必要なステータスチェック: `Backend Lint`, `Frontend Lint`, `Backend Tests`, `Frontend Tests`, `E2E Tests`, `Terraform Format Check`, `Terraform Plan (dev)`

## [pokelingual] backend の後方互換

- backend は常に直近1つ前の frontend と後方互換を保つ (backend → frontend の順で独立してデプロイするため、一時的に backend だけ先のバージョンに進む。ADR-026)
- 契約を壊す変更 (フィールド削除・型変更・必須化など) は一度のリリースに混ぜず、backend を新旧両対応にするリリース → frontend を新契約に切り替えるリリース → backend から旧対応を外すリリース、の複数リリースに分ける
