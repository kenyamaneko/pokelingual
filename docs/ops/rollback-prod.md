# prod リリースのロールバック手順

prod へのリリース (`v*` タグ push) 後に不具合が発覚したときの切り戻し手順。prod は自動ロールバックを持たない (ADR-025) ため、切り戻しは本手順の手動操作で行う。

## 原則は修正を新しいタグで出す

問題コミットを `git revert` した PR を main にマージし (CI と dev 環境で検証される)、新しい PATCH タグでリリースする。以降の節の切り戻しは、修正の目処が立たないまま利用者影響が続いている場合や、CI 自体が壊れている場合の一時対応とする。

```bash
git revert <問題コミット>   # PR を作成して main へマージ

git checkout main && git pull
git tag vX.Y.Z              # PATCH を上げる
git push origin vX.Y.Z
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
- **トラフィックのピン留め**：`--to-revisions` はトラフィックを指定リビジョンへ固定する。以降のデプロイは新リビジョンを作るがトラフィックは移らない ([troubleshooting.md](troubleshooting.md) の「Cloud Run のトラフィックがデプロイ後も古いリビジョンに向いていた」)。deploy-prod.yml は最後に `--to-latest` を実行するため次のタグデプロイで固定は解除されるが、手動で最新へ戻すときは次を実行する。

  ```bash
  gcloud run services update-traffic pokelingual-api-prod \
    --region asia-northeast1 --project pokelingual-prod --to-latest
  ```

## frontend を旧バージョンへ切り戻す

[Firebase Console](https://console.firebase.google.com/) → Hosting → リリース履歴で、対象バージョンの「ロールバック」を実行する。firebase-tools に専用のロールバックコマンドはないが、バージョン ID (リリース履歴で確認できる) が分かっていれば `hosting:clone` でも同じ切り戻しができる。

```bash
npx firebase-tools hosting:clone pokelingual-prod:@<バージョンID> pokelingual-prod:live
```

## タグを指定して deploy-prod を再実行する

backend と frontend を同時に旧タグの内容へ揃え直す場合は、旧タグを ref に指定して deploy-prod.yml を手動起動できる。

```bash
gh workflow run deploy-prod.yml --ref vX.Y.Z
```

実行されるのは指定タグ時点の workflow 定義なので、この経路は対象タグが deploy-prod.yml を含む場合に限り使える。含むかどうかは次で確認する (一覧に deploy-prod.yml が無ければ使えない)。

```bash
git ls-tree vX.Y.Z --name-only .github/workflows/
```

deploy-prod.yml を含まない古いタグへ戻すときはこの経路を使わず、revert からの新しいタグで出し直す。

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

恒久修正を main に入れ、新しい PATCH タグでリリースする。deploy-prod.yml は毎回 `--to-latest` を適用するため、手動のトラフィック切替はこのリリースで解消される。
