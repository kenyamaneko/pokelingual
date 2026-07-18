# prod リリース手順

SemVer（`vMAJOR.MINOR.PATCH`）の Git タグでバージョンを管理する。タグ `v*` の push で `deploy-prod.yml` が起動し、同一コミットを prod へ再ビルド・デプロイする（再テストなし）。

```bash
# 1. feature/xxx → main に PR をマージ（dev デプロイが実行される）

# 2. main でタグ付け → タグ push で prod デプロイ（クリーンなバージョン番号）
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0
```

タグ付け後に `main` へ追加コミットが積まれれば、dev 環境のバージョンは `v1.0.0-N-g<sha>`（リリースから N コミット先）と表示される。

リリース後に不具合が発覚したときの切り戻しは[ロールバック手順](rollback-prod.md)に従う。
