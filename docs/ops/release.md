# prod リリース手順

SemVer（`vMAJOR.MINOR.PATCH`）の Git タグでバージョンを管理する。タグは CI が打つ。GitHub Actions の「Deploy to Prod」を `main` で実行すると、選んだバージョンの種類 (patch / minor / major) で最新の `v*` タグから次のタグを決めて打ち、同一コミットを prod へ再ビルド・デプロイする（再テストなし）。`main` 以外から実行するとタグを打たず、デプロイもされない。

```bash
# 1. feature/xxx → main に PR をマージ（dev デプロイが実行される）

# 2. main で「Deploy to Prod」を実行 → CI がタグを打って prod デプロイ
gh workflow run deploy-prod.yml --ref main -f bump=patch   # patch / minor / major
```

タグ付け後に `main` へ追加コミットが積まれれば、dev 環境のバージョンは `v1.0.0-N-g<sha>`（リリースから N コミット先）と表示される。

リリース後に不具合が発覚したときの切り戻しは[ロールバック手順](rollback-prod.md)に従う。
