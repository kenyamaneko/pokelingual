# アラート対応と緊急停止の手順

Cloud Monitoring / Billing Budget のアラートが発報したときの初動と、サービスを一時的に絞る・止めるための手順。

## アラート一覧

アラートの定義は `terraform/main.tf` と `terraform/budget.tf` にある。dev は動作確認でエラーパスを意図的に踏むため、Cloud Monitoring のアラートは prod のみに作られる。

| アラート | 条件 | 通知先 |
|---|---|---|
| Cloud Run 5xx Error Rate (prod) | 5xx 応答が 5 req/s を5分間超過 | email + Slack |
| Cloud Run High Latency (prod) | p95 レイテンシが 5 秒を5分間超過 | email + Slack |
| Application Error Logs (prod) | severity=ERROR のログが5分間に1件以上 | email + Slack |
| 月次予算 (dev / prod) | 月予算の 50% / 80% / 100% 到達 | email |

Slack 通知は、手動作成した通知チャネルを terraform 変数 `slack_notification_channel_id` で渡した場合のみ付く。予算アラートの通知は数時間から半日遅れる。

## 共通の初動

1. 直近に prod リリースがなかったかを確認する。リリース直後の発報ならリリース起因を疑い、[ロールバック手順](rollback-prod.md) に進む。

   ```bash
   gh run list --workflow deploy-prod.yml --limit 5
   ```

2. Cloud Monitoring のダッシュボード「PokeLingual Backend (prod)」(`terraform/dashboard.json` で管理) でリクエスト数・エラー・レイテンシの推移を見る。

3. エラーログを読む。

   ```bash
   gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="pokelingual-api-prod" AND severity>=ERROR' \
     --project pokelingual-prod --freshness=1h --limit 20
   ```

## アラート別の見どころ

- **Application Error Logs**：しきい値が「1件以上」のため単発のエラーでも発報する。まず該当ログを読み、外部 API (PokeAPI / Vertex AI) の一過性の失敗なら経過観察、続いていれば 5xx と同じ扱いにする。
- **5xx / High Latency**：リリース起因でなければ外部 API の障害か負荷を疑う。ログのエラーメッセージで呼び出し先を特定し、負荷起因なら次節で利用量を絞る。
- **月次予算**：Billing のレポートでサービス別の内訳を確認する (想定上の主要因は Vertex AI)。アプリ層のレートリミット (1ユーザー 30回/日・全体 1,500回/日、ADR-021) が上限装置なので、上限に達していないのに予算を超過するペースなら単価が想定とずれている。次節で上限を下げる。

## 利用量を一時的に絞る

レートリミットの上限は Cloud Run の環境変数で下げられる。

```bash
gcloud run services update pokelingual-api-prod \
  --region asia-northeast1 --project pokelingual-prod \
  --update-env-vars "GLOBAL_DAILY_LIMIT=100"
```

この変更は次の `v*` タグデプロイで deploy-prod.yml に書かれた値に戻る。恒久的に変えるときは deploy-prod.yml の値を修正して新しいタグでリリースする。

## サービスを緊急停止する

権利者からの申し立てなど、サービス全体を即時に公開停止する場合の手順 (README の「ライセンス & 法的事項」を根拠とする)。

1. frontend の配信を止める。

   ```bash
   npx firebase-tools hosting:disable --project pokelingual-prod
   ```

2. backend への公開アクセスを止める。IAM の反映には数分かかる ([troubleshooting.md](troubleshooting.md) の「Cloud Run IAM ポリシーの伝播遅延」)。

   ```bash
   gcloud run services remove-iam-policy-binding pokelingual-api-prod \
     --region asia-northeast1 --project pokelingual-prod \
     --member=allUsers --role=roles/run.invoker
   ```

3. 停止中は `v*` タグを打たない。deploy-prod.yml は毎回 `--allow-unauthenticated` を適用し hosting も再デプロイするため、タグデプロイが停止を解除してしまう。

## 停止の解除

backend は公開アクセスを付け直す。

```bash
gcloud run services add-iam-policy-binding pokelingual-api-prod \
  --region asia-northeast1 --project pokelingual-prod \
  --member=allUsers --role=roles/run.invoker
```

frontend は配信内容の再デプロイで再開する。`hosting:disable` に対応する単体の再有効化コマンドはないため、Firebase Console → Hosting → リリース履歴で停止前のバージョンを「ロールバック」で再公開するか、CLI で停止前のバージョンを複製する ([ロールバック手順](rollback-prod.md) の frontend 節と同じ機構)。

```bash
npx firebase-tools hosting:clone pokelingual-prod:@<停止前のバージョンID> pokelingual-prod:live
```
