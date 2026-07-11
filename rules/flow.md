> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual デリバリー運用 (overlay)

ブランチ戦略とデプロイの共通ルールは keyandnotes-rules を SSoT とし、本ファイルは pokelingual 固有の実装詳細のみを記す。

- ブランチ戦略 (GitHub Flow): `../keyandnotes-rules/rules/flow/github-flow.md`
- デプロイ戦略 (Merge → Dev, Tag → Prod): `../keyandnotes-rules/rules/deploy/merge-dev-tag-prod.md`

## [flow] 環境への反映

`main` push → dev、`main` 上のタグ (`v*`) push → prod へ自動デプロイ。トリガーの実装は `.github/workflows/deploy-dev.yml` / `.github/workflows/deploy-prod.yml` を参照。

## [flow] バージョニング

タグ形式 (`vMAJOR.MINOR.PATCH`) とバージョン検出 (`git describe --tags --always`) の詳細は `docs/adr/009-semver-versioning.md` を参照。

## [flow] デプロイ後の検証と prod デプロイ

dev デプロイ後は検出専用スモークのみ (ヘルス＋認証付き read、ロールバックなし)。dev と prod は別プロジェクト・別レジストリのため、prod は共通戦略の同一成果物昇格ではなく、タグ時に同一コミットを再ビルドする (テストは走らせない)。詳細は `docs/adr/015-deploy-pipeline-and-smoke.md`。

## [flow] ブランチ保護 (GitHub Rulesets)

`main` の保護は ruleset `main-protection` で設定する (直 push 禁止 / PR マージのみ / 必須チェック: CI の lint・test・E2E・terraform fmt)。
