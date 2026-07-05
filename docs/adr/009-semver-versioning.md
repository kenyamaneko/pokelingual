# ADR-009: SemVer バージョニングの導入

## ステータス

Accepted

## 結論

ユーザーに分かりやすいバージョン表示とリリース管理のため、Semantic Versioning（`vMAJOR.MINOR.PATCH`）を採用し、Git タグをバージョンの情報源とする。設定画面に読みやすいバージョンが表示され、Git タグでリリースポイントが明確になり、Docker イメージにもバージョンタグが付与される。既存のブランチ push トリガーはそのまま動作する。

## 背景・課題

prod リリースに向けてバージョン管理が必要になった。これまでは `github.sha`（コミットハッシュ）をビルドバージョンとして使い、設定画面に先頭 7 文字のハッシュを表示していた。ハッシュはユーザーにとって意味が分かりにくく、リリース管理にも不向きだった。

## 詳細

### バージョン形式

`vMAJOR.MINOR.PATCH`（例：`v1.0.0`）

| 変更の種類 | 更新する桁 | 例 |
|---|---|---|
| 破壊的変更・大規模機能追加 | MAJOR | `v1.0.0` → `v2.0.0` |
| 機能追加（後方互換あり） | MINOR | `v1.0.0` → `v1.1.0` |
| バグ修正・小修正 | PATCH | `v1.0.0` → `v1.0.1` |

### バージョン検出

CI/CD パイプライン内で `git describe --tags --always` を実行する。

- タグ付きコミット → `v1.0.0`（クリーンなバージョン）
- タグから N コミット後 → `v1.0.0-3-gabc1234`（開発中バージョン）
- タグなし → `abc1234`（短縮 SHA、初回タグ前の互換性）

### デプロイトリガー

`v*` タグの push でも prod デプロイが実行される。

### リリース手順

```bash
# 1. develop → main に PR マージ（prod デプロイが実行される）

# 2. main でタグ付け → タグ push で prod 再デプロイ（クリーンなバージョン番号）
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0

# 3. main → develop にマージバック（タグを develop に伝播）
git checkout develop && git pull
git merge main
git push origin develop
```

マージバックにより develop での `git describe` が `v1.0.0-N-g<sha>` を返し、dev 環境でも「どのリリースから何コミット先か」が分かる。
