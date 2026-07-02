> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# Branching Strategy (GitHub Flow)

pokelingual のブランチ戦略。`principles.md` から参照される。

## 概要

短命の `feature/*` を切り、PR で環境ブランチにマージする。永続ブランチは `develop` (dev) と `main` (prod) の 2 本。`feature/*` を `develop` に統合して dev で検証し、`develop → main` で prod へ昇格する。

環境差分はコードで表現する (Terraform は `environments/{dev,prod}/*.tfvars` を workspace ごとに apply)。

## ブランチ

| ブランチ | 環境 | 寿命 | 派生元 | マージ先 |
|---|---|---|---|---|
| `main` | prod | 永続 | — | — |
| `develop` | dev | 永続 | `main` | `main` |
| `feature/xxx` | — | 短命 | `develop` | `develop` |

- **main**: prod のソース・オブ・トゥルース。マージ元は `develop`。タグは手動で打つ (`docs/adr/009-semver-versioning.md`)
- **develop**: dev のソース。常にデプロイ可能に保つ統合ブランチ
- **feature/xxx**: すべての変更 (機能・修正・リファクタ・ドキュメント) をここで行う。命名 `feature/{issue番号}-{概要}`。短命に保ち、PR マージ時に削除

## フロー

```
feature/{n}-{summary}  ─PR→   develop      # dev にデプロイ・統合テスト/E2E
develop                ─PR→   main         # prod にデプロイ
main で git tag vX.Y.Z && push             # クリーンなバージョンで prod 再デプロイ
main                   ─merge→ develop      # タグを develop に伝播 (ADR-009)
```

緊急修正も同じフローを通す。

## バージョニング

Semantic Versioning。タグは手動で打つ (`docs/adr/009-semver-versioning.md`)。

- **MAJOR**: 破壊的変更 (REST API スキーマ破壊等)
- **MINOR**: 後方互換の機能追加
- **PATCH**: バグ修正・ドキュメント・内部リファクタ

## 環境への反映

`develop` push → dev、`main` push → prod へ自動デプロイ。手順は `.github/workflows/deploy.yml` を参照。

## ブランチ保護 (GitHub Rulesets)

- **main**: 直 push 禁止 / PR マージのみ (linear history) / force push・削除禁止 / マージ元は `develop` / 必須チェック: CI の lint・test
- **develop**: 直 push 禁止 / PR マージのみ / 必須チェック: CI の lint・test
