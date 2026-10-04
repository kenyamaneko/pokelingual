# prod リリースのロールバック手順

prod へのリリース (「Deploy to Prod」の実行) 後に不具合が発覚したときの切り戻し手順。prod は自動ロールバックを持たない (ADR-025) ため、切り戻しは本手順の手動操作で行う。

## 原則は修正を新しいタグで出す

問題コミットを `git revert` した PR を main にマージし (CI と dev 環境で検証される)、「Deploy to Prod」を `patch` で実行して修正をリリースする。以降の節の切り戻しは、修正の目処が立たないまま利用者影響が続いている場合や、CI 自体が壊れている場合の一時対応とする。

```bash
git revert <問題コミット>   # PR を作成して main へマージ

gh workflow run deploy-prod.yml --ref main -f bump=patch
```

## backend を旧リビジョンへ切り戻す

ビルドを伴わないトラフィック切替のみのため、数分で完了する。

1. 戻し先のリビジョンを特定する。

   ```bash
   gcloud run revisions list --service pokelingual-api-prod \
     --region asia-northeast1 --project pokelingual-prod
   ```

2. トラフィックを切り替える。

   ```bash
   gcloud run services update-traffic pokelingual-api-prod \
     --region asia-northeast1 --project pokelingual-prod \
     --to-revisions <リビジョン名>=100
   ```

注意が2点ある。

- **契約の向き**：互換保証は「backend が frontend と同じか新しい」向きにしかない (ADR-026)。frontend を新しいまま backend だけ古くすると保証の逆向きになるため、切り戻し先のリリース以降に API 契約の変更が入っている場合は frontend も対になるバージョンへ戻す。
- **トラフィックのピン留め**：`--to-revisions` はトラフィックを指定リビジョンへ固定する。以降のデプロイは新リビジョンを作るがトラフィックは移らない。deploy-prod.yml は最後に `--to-latest` を実行するため次の「Deploy to Prod」の実行で固定は解除されるが、手動で最新へ戻すときは次を実行する。

  ```bash
  gcloud run services update-traffic pokelingual-api-prod \
    --region asia-northeast1 --project pokelingual-prod --to-latest
  ```

## frontend を旧バージョンへ切り戻す

[Firebase Console](https://console.firebase.google.com/) → Hosting → リリース履歴で、対象バージョンの「ロールバック」を実行する。firebase-tools に専用のロールバックコマンドはないが、バージョン ID (リリース履歴で確認できる) が分かっていれば `hosting:clone` でも同じ切り戻しができる。

```bash
npx firebase-tools hosting:clone pokelingual-prod:@<バージョンID> pokelingual-prod:live
```

## 旧バージョンの内容へ揃え直す

backend と frontend を同時に旧タグの内容へ揃え直す場合は、旧タグ以降の変更をまとめて revert する PR を main にマージし、「Deploy to Prod」を `patch` で実行する。タグは CI が打つため、旧タグを指定した再実行はできない。revert の範囲にはワークフローの変更も含まれ、「Deploy to Prod」が実行できなくなるため、ワークフローは main の現行のまま残す。

```bash
git checkout -b revert-to-vX.Y.Z origin/main
git revert --no-commit vX.Y.Z..origin/main
git checkout origin/main -- .github
git commit   # PR を作成して main へマージ

gh workflow run deploy-prod.yml --ref main -f bump=patch
```

## 切り戻し後の確認

backend はヘルスとトラフィックの向き先を確認する。

```bash
URL=$(gcloud run services describe pokelingual-api-prod \
  --region asia-northeast1 --project pokelingual-prod \
  --format 'value(status.url)')
curl -s -o /dev/null -w "%{http_code}" "${URL}/health"   # 200 であること

gcloud run services describe pokelingual-api-prod \
  --region asia-northeast1 --project pokelingual-prod \
  --format yaml | grep -A5 traffic
```

frontend は設定画面のバージョン表示が意図したバージョンであることを確認する。

prod にはデプロイ後の自動スモークがまだない (#97 で追加予定) ため、最後に画面から主要動線 (ログイン → クエスト開始) を手で確認する。

## 切り戻し状態の解消

恒久修正を main に入れ、「Deploy to Prod」を `patch` で実行してリリースする。deploy-prod.yml は毎回 `--to-latest` を適用するため、手動のトラフィック切替はこのリリースで解消される。
