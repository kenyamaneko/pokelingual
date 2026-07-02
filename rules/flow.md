> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# Branching Strategy (GitHub Flow)

pokelingual のブランチ戦略。`principles.md` から参照される。

## 概要

GitHub Flow をベースに、release / hotfix / stg といった ceremony を持たない軽量な運用を採用する。短命の `feature/*` ブランチを切り、PR でマージする。専用の `release/*` `hotfix/*` ブランチは設けない。

pokelingual は環境ブランチとして `develop` (dev) と `main` (prod) の 2 本の永続ブランチを持つ。`feature/*` は `develop` から切って `develop` に戻し、dev 環境で検証したうえで `develop → main` で prod へ昇格させる。

環境差分はブランチではなくコードで表現する (Terraform は `environments/{dev,prod}/*.tfvars` を workspace ごとに apply する)。

## ブランチ一覧

| ブランチ | 環境 | 寿命 | 派生元 | マージ先 | 保護 |
|---|---|---|---|---|---|
| `main` | prod | 永続 | — | — | 最大 |
| `develop` | dev | 永続 | `main` (初回のみ) | `main` | あり |
| `feature/xxx` | なし | 短命 | `develop` | `develop` | なし |

## ブランチ運用ルール

### main

- **prod 環境のソース・オブ・トゥルース**。main の HEAD = prod で動作しているコード
- 直 push 禁止。PR 経由のマージのみ
- マージ元として許可するのは `develop` のみ (`feature/*` を直接 main にマージしない)
- タグは手動で打つ。CI では自動生成しない (詳細は `docs/adr/009-semver-versioning.md`)
- force push 禁止、履歴書き換え禁止

### develop

- **dev 環境のソース**。常にデプロイ可能に保つ統合ブランチ
- 直 push 禁止。PR 経由のマージのみ
- マージ元として許可するのは `feature/*` と、リリース時の `main` からのマージバック (タグ伝播)
- CI green 必須。レビューは self-approve 可 (一人開発での速度優先)

### feature/xxx

- すべての変更 (新機能・バグ修正・リファクタ・ドキュメント) はこのブランチで行う
- `develop` から切って `develop` にマージ
- 命名: `feature/{issue番号}-{概要}` (例: `feature/42-add-foo`)
- 短命に保つ (目安: 数時間〜数日)。長期化する場合は分割を検討する
- PR マージ時にブランチ削除

## 通常フロー

```
1. feature ブランチを切る
   └─ git fetch origin && git switch -c feature/{n}-{summary} origin/develop

2. 実装・コミット
   └─ ローカルでテスト・ビルド・lint を通す

3. push → PR
   └─ feature/xxx → develop (PR)
   └─ CI green 後にマージ。develop push で dev 環境に自動デプロイ (統合テスト・E2E が走る)
   └─ feature ブランチ削除
```

## 緊急修正 (hotfix)

GitHub Flow では hotfix 専用のブランチ種別を設けない。緊急修正も通常の `feature/*` と同じく `develop` を経由して `main` へ昇格させる。専用の `release/*` `hotfix/*` ブランチや back-merge ceremony は持たない。

- `develop` から `feature/{issue番号}-{概要}` を切る
- 修正 → PR → `develop`(dev で検証) → `develop → main`(prod へ昇格)
- 急ぎの場合でも PR を経由する。直 push でのバイパスは禁止

## リリースフロー (develop → prod)

```
1. feature を develop に統合し dev 環境で検証
   └─ feature/xxx → develop (PR)
   └─ develop push で dev 環境に自動デプロイ

2. develop → main にマージ
   └─ develop → main (PR)
   └─ main push で prod 環境に自動デプロイ

3. main で手動タグ付け (ADR-009)
   └─ git tag vX.Y.Z && git push origin vX.Y.Z
   └─ タグ push で prod 再デプロイ (クリーンなバージョン番号)

4. main → develop にマージバック
   └─ タグを develop に伝播させ、dev 環境の git describe が vX.Y.Z-N-g<sha> を返すようにする
```

## バージョニング

Semantic Versioning (SemVer) を採用する。タグは手動で打つ (CI では自動生成しない)。詳細は `docs/adr/009-semver-versioning.md` を参照。

- **MAJOR**: 破壊的変更 (REST API スキーマ破壊、既存クライアントが動かなくなる変更等)
- **MINOR**: 後方互換のある機能追加
- **PATCH**: バグ修正、ドキュメント修正、内部リファクタ

## 環境への反映

各ブランチへの push / merge を契機に、対応する環境へデプロイする。具体的な手順は `.github/workflows/deploy.yml` を参照。

典型的な反映パターン:

- **アプリ (Cloud Run + Firebase Hosting)**: `develop` push → dev、`main` push → prod へ自動デプロイ
- **Terraform**: `environments/{dev,prod}/*.tfvars` を対象環境の workspace で plan / apply

## ブランチ保護設定

GitHub Rulesets で以下を設定する。必須ステータスチェックの具体名は CI 設定を参照。

### main

- 直 push 禁止
- PR マージのみ許可 (linear history)
- force push 禁止、削除禁止
- 履歴書き換え禁止
- 必須ステータスチェック: CI の lint / test が green
- マージ元ブランチ制限: `develop` のみ

### develop

- 直 push 禁止
- PR マージのみ許可
- 必須ステータスチェック: CI の lint / test が green
- required reviews: 不要 (一人開発での速度優先)
