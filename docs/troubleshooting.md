# トラブルシューティング記録

開発中に遭遇した問題と解決策の記録。

---

## 1. Cloud Run のトラフィックがデプロイ後も古いリビジョンに向いていた

### 症状

- `gcloud run deploy` でデプロイ成功するが、アプリが古いコードのまま
- PokeAPI を呼んでいるはずなのにレスポンスが ~100μs（モック実装の速度）
- `APP_MODE=real` を設定したのに、起動ログに `Starting in mock mode` と表示

### 原因

Cloud Run のトラフィックルーティングには2つのモード:
1. **`latestRevision: true`**（デフォルト）— 新リビジョンに自動ルーティング
2. **`latestRevision: false`**（ピン留め）— 特定リビジョンに固定

ロールバック時に `--to-revisions REVISION=100` を使うと、モードが2に切り替わる。
以降の `gcloud run deploy` は新リビジョンを作成するが、トラフィックは古いリビジョンに向いたまま。

### 解決

deploy.yml のデプロイ後に `--to-latest` ステップを追加:

```yaml
- name: Route traffic to latest revision
  run: |
    gcloud run services update-traffic $SERVICE \
      --region $REGION --project $PROJECT \
      --to-latest
```

### 調査方法

```bash
# トラフィック状態を確認
gcloud run services describe SERVICE --region REGION --format yaml | grep -A5 traffic

# リビジョン一覧と環境変数を確認
gcloud run revisions list --service SERVICE --region REGION
gcloud run revisions describe REVISION --region REGION --format yaml | grep -A5 env
```

### 学び

- `gcloud run deploy` は必ずしも新リビジョンにトラフィックを向けない
- ロールバック → 次のデプロイ の間にこの問題が潜む
- Cloud Run のレスポンス時間が異常に速い場合、モック実装が動いている可能性がある

---

## 2. 結合テストが 403 "access denied" で全失敗

### 症状

- CI の結合テスト（`scripts/integration-test.sh`）で全 API が 403 を返す
- ローカルや手動テストでは問題なし

### 原因

GitHub Actions の deploy サービスアカウント（`github-actions-deploy`）に Firestore の読み書き権限がなかった。

結合テストの前処理で「テストユーザーのメールを `config/auth` の `allowed_emails` に追加」するステップがあるが、
deploy SA に `roles/datastore.user` がなかったため、Firestore への書き込みが**サイレントに失敗**。

結果として `allowed_emails` にテストユーザーが登録されず、バックエンドの認証ミドルウェアが 403 を返した。

### 解決

Terraform で deploy SA に `roles/datastore.user` を付与:

```hcl
resource "google_project_iam_member" "github_actions_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}
```

### 学び

- Firestore REST API の書き込み失敗は curl が 403 を返すだけ。スクリプト内で `set -e` していても、curl の exit code は 0 なので見落としやすい
- CI で使うサービスアカウントの権限は、「テスト前処理」で必要な権限も含めて設計する

---

## 3. フロントエンドで description が空文字 `""` になる

### 症状

- QuestPage に `Who's That Pokemon? ""` と表示される
- エラー画面にはならない

### 原因

バックエンドがモックモードで動いていた（上記 #1 の問題）。
`MockPokemonFetcher.getRandomPokemon()` は固定のテストデータを返すが、条件によっては空の description になる場合がある。

また、バックエンドが prod モードに切り替わった後も 401 エラーが返されていたが、
フロントエンドの QuestPage はエラーハンドリングが不十分で、axios エラーを catch した後にデフォルトの空文字状態のまま表示していた。

### 解決

1. Cloud Run のトラフィックを最新リビジョン（prod モード）にルーティング
2. QuestPage の `getErrorMessage()` を強化:
   - 401: 「にんしょうに しっぱいしました。ログインし なおしてね」
   - 403: 「アクセスけんが ありません」
   - 502: 「がいぶサービスが おうとうしません」
   - その他: ステータスコードを表示

### 学び

- API エラー時に「何も表示しない」のは最悪のUX。エラーメッセージを必ず表示する
- モック実装が意図せず本番で動いているケースは、レスポンス時間で見抜ける

---

## 4. Terraform: WIF Pool が削除後に再作成できない

### 症状

```
Error: Error creating WorkloadIdentityPool: googleapi: Error 409: Requested entity already exists
```

`terraform destroy` 後に `terraform apply` すると、WIF Pool の作成でエラー。

### 原因

Google Cloud の Workload Identity Pool は削除後 30 日間 soft-delete 状態になる。
この間は同名の Pool を作成できず、`terraform import` もできない。

### 解決

REST API で undelete:

```bash
curl -X POST \
  "https://iam.googleapis.com/v1/projects/PROJECT/locations/global/workloadIdentityPools/POOL_ID:undelete" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json"
```

undelete 後に `terraform import` で state に取り込む。

### 学び

- Google Cloud の一部リソースは soft-delete がある。`destroy` 前に確認
- WIF Pool を壊すと CI/CD が完全に止まるため、慎重に扱う

---

## 5. Terraform: Cloud Run の PORT 環境変数でエラー

### 症状

```
Error: PORT environment variable is reserved
```

### 原因

Cloud Run は `PORT` を予約環境変数として自動設定する（デフォルト 8080）。
`--update-env-vars` で `PORT` を手動設定するとエラーになる。

### 解決

`PORT` の手動設定を削除。アプリ側で `PORT` 環境変数を読み取る（Cloud Run が自動設定する値を使う）。

---

## 6. CORS エラー: PUT メソッドがブロックされる

### 症状

- Settings ページで除外ポケモンを追加すると、ブラウザのコンソールに CORS エラー
- `PUT /api/settings/excluded-pokemon` が preflight で拒否される

### 原因

`middleware/cors.go` の `AllowMethods` に `PUT` が含まれていなかった。

```go
// Before
AllowMethods: []string{"GET", "POST", "OPTIONS"},

// After
AllowMethods: []string{"GET", "POST", "PUT", "OPTIONS"},
```

### 学び

- 新しい HTTP メソッドを使うエンドポイントを追加したら、CORS 設定も更新する
- ブラウザは `GET`, `POST` 以外のメソッドで preflight（OPTIONS）を送信する

---

## 7. Cloud Run IAM ポリシーの伝播遅延

### 症状

- デプロイ直後に結合テストを実行すると 401 が返る
- 数分待つと正常に動く

### 原因

`--allow-unauthenticated` で設定される IAM ポリシー（`allUsers: roles/run.invoker`）は即座に反映されない。
Google Cloud の IAM ポリシーの伝播に最大数分かかる。

### 解決

結合テスト実行前に IAM 伝播を待つループを追加:

```bash
for i in $(seq 1 18); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$URL")
  if [ "${STATUS}" != "401" ]; then
    break  # IAM 通過（200 or 403 = アプリレベルの問題）
  fi
  sleep 10
done
```

- 401 = Cloud Run IAM レベルでの拒否（まだ伝播していない）
- 200/403 = IAM は通過した（403 はアプリレベルの認証問題）

---

## 8. google-beta provider で identitytoolkit 403 エラー

### 症状

```
Error 403: Identity Toolkit API has not been used in project before
```

Terraform で `google_identity_platform_config` を作成しようとすると 403。

### 原因

`google-beta` provider はデフォルトでリソースのプロジェクトに対して API を呼ぶが、
`identitytoolkit.googleapis.com` がまだ有効化されていない場合にこのエラーが出る。

### 解決

`google-beta` provider に `user_project_override = true` と `billing_project` を設定:

```hcl
provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}
```

---

## 9. Terraform: API 有効化後のリソース作成失敗

### 症状

`terraform apply` で `google_project_service` の API 有効化直後に、その API を使うリソースの作成が失敗。

### 原因

Google Cloud API の有効化後、内部的な伝播に 30-60 秒かかる場合がある。
Terraform は `google_project_service` 完了後すぐに次のリソースを作成しようとする。

### 解決

`depends_on` を設定して依存関係を明示しつつ、初回は失敗したら再度 `terraform apply` を実行。
2回目以降は API が伝播済みのため成功する。

---

## 10. フロントエンドの API リクエストが Firebase Hosting に向いていた

### 症状

- QuestPage に `Who's That Pokemon? ""` と表示される（description が空）
- エラー画面にはならず、フェーズは "translating" に遷移している
- バックエンド単体は正常にレスポンスを返す

### 原因

GitHub 環境シークレットに `API_BASE_URL` が未設定だった。

フロントエンドのビルド時に `VITE_API_BASE_URL` が空文字になり、Axios の `baseURL` が `"/api"` に設定される。
結果、フロントエンドは Cloud Run バックエンドではなく Firebase Hosting 自身（同一オリジン）にリクエストを送信。

Firebase Hosting の SPA リライトルール (`"source": "**" → /index.html`) により、
`/api/quest/new` へのリクエストが `index.html`（HTML）を 200 で返す。

Axios は HTTP 200 を受け取るためエラーにならず、`res.data` が HTML 文字列になる。
`quest.description_en` が `undefined` となり、空表示になった。

### 調査方法

```bash
# デプロイ済み JS バンドルの baseURL を確認
curl -s "https://pokelingual-dev.web.app/assets/index-*.js" | grep -oE 'baseURL:"[^"]*"'
# → baseURL:"/api" なら API_BASE_URL が未設定

# Firebase Hosting が API パスに HTML を返すことを確認
curl -s -o /dev/null -w "%{http_code} %{content_type}" "https://pokelingual-dev.web.app/api/quest/new"
# → 200 text/html なら Firebase Hosting がリライトしている

# GitHub 環境シークレットの一覧を確認
gh secret list --env dev | grep API_BASE_URL
```

### 解決

GitHub 環境シークレット `API_BASE_URL` を Cloud Run のサービス URL に設定:

```bash
# Cloud Run URL を取得
URL=$(gcloud run services describe pokelingual-api-dev --region asia-northeast1 --project pokelingual-dev --format 'value(status.url)')

# GitHub シークレットに設定
gh secret set API_BASE_URL --env dev --body "${URL}"
```

フロントエンドの再デプロイ（develop への push）で反映。

### 学び

- `VITE_API_BASE_URL` が空でもビルドエラーにならず、サイレントに同一オリジンにリクエストが飛ぶ
- SPA のリライトルールが API パスも捕捉するため、200 OK + HTML が返る = Axios のエラーハンドリングをすり抜ける
- `gh secret list --env ENV` でシークレットの存在確認ができる。deploy 後の不具合調査で有用

---

## 11. クエストの英語説明文と日本語説明文がバージョン違いだった

### 症状

クエスト画面で表示される英語の説明文と日本語の説明文が明らかに内容が異なっていた。
例: Druddigon (#621) で EN は Y版「It warms its body by absorbing sunlight...」、JA は Ωルビー版「狭い 洞穴を 走り回り...」。

### 原因

`pokeapi_service.go` の `fetchFromAPI()` で EN と JA の説明文をそれぞれ「最初に見つかったもの」から取得しており、PokeAPI のエントリ順序に依存して異なるバージョンのテキストがペアになっていた。

一方、コレクション詳細画面の `buildFlavorTextPairs()` はバージョン単位でグルーピングしてペアを作っていたため正しく表示されていた。

### 解決

1. `fetchFromAPI()` の greedy first-match ロジックを削除
2. `buildFlavorTextPairs()` で構築済みの正しいペアから `DescriptionEN`/`DescriptionJA` を設定
3. `quest_service.go` の `NewQuest()` で `FlavorTexts` からランダムにペアを選択（クエストごとに異なるバージョンの説明文が登場する）

### 学び

- PokeAPI の `flavor_text_entries` はバージョン順に EN/JA がグルーピングされていない。言語ごとに独立して走査すると異なるバージョンが混ざる
- 図鑑の説明文取得はバージョン単位でペアリングするロジック（`buildFlavorTextPairs`）に統一すべき
- モック実装はハードコードされた正しいペアを返すため、この問題は本番環境でのみ発生する

---

## 12. 本番環境で説明文が空（API_BASE_URL 未設定）

### 症状

prod 環境のクエスト画面で英語の説明文が空（`""`）表示。エラーメッセージは出ない。

### 原因

prod の GitHub Environment に `API_BASE_URL` シークレットが未設定だった。
`VITE_API_BASE_URL` が空文字でビルドされ、フロントエンドの API リクエスト先が Cloud Run ではなく Firebase Hosting（`/api/...`）になっていた。
Firebase Hosting は SPA rewrite で `index.html`（200 OK）を返すため、axios はエラーにならないが `res.data.description_en` が `undefined` になり空表示。

### 解決

prod 環境に `API_BASE_URL` シークレット（Cloud Run の URL）を追加して再デプロイ。

### 学び

- 新しい環境（prod）をセットアップする際は、全 GitHub Secrets を漏れなく設定すること
- API レスポンスが予期せず HTML になるケースでは axios は 200 OK で成功扱いになる。レスポンス型のランタイム検証があるとこの手のバグを早期検出できる

---

## 13. Cloud Run デプロイで `iam.serviceaccounts.actAs` 権限エラー

### 症状

prod への初回 Cloud Run デプロイで `Permission 'iam.serviceaccounts.actAs' denied on service account PROJECT_NUMBER-compute@developer.gserviceaccount.com` エラー。

### 原因

`gcloud run deploy` に `--service-account` フラグがなかった。新規サービス作成時に Cloud Run がデフォルトの Compute Engine SA を使おうとするが、deploy SA には Terraform で作成したカスタム backend SA（`pokelingual-api-{env}`）への `serviceAccountUser` 権限しか付与されていない。

### 解決

`deploy.yml` に `--service-account` フラグを追加して、カスタム backend SA を明示指定。

### 学び

- Cloud Run は `--service-account` 未指定時にデフォルト Compute Engine SA を使う
- Terraform で専用 SA を作成している場合は、deploy コマンドで明示的に指定する必要がある
- dev では既にサービスが存在していたため問題が顕在化せず、prod の初回デプロイで発覚した

---

## 14. Playwright E2E テストで全角スペースのテキストが見つからない

### 症状

`getByRole("link", { name: /ぼうけんに\u3000出かける/ })` が 30 秒タイムアウト。要素は画面に表示されているのに見つからない。

### 原因

Playwright はアクセシブル名を取得する際にホワイトスペースを正規化し、全角スペース（`\u3000`）を半角スペースに変換する。そのためリテラルの `\u3000` を含む正規表現はマッチしない。

### 解決

正規表現で `.`（任意の1文字）を使い、全角・半角どちらのスペースにもマッチさせる:

```typescript
// Before: タイムアウト
await page.getByRole("link", { name: /ぼうけんに\u3000出かける/ });

// After: OK
await page.getByRole("link", { name: /ぼうけんに.出かける/ });
```

### 学び

- Playwright の `getByRole`, `getByPlaceholder` はアクセシブル名のホワイトスペースを正規化する
- `getByText` も同様に影響を受ける場合がある
- 全角スペースを多用する日本語 UI では、正規表現の `.` で任意の空白文字にマッチさせるのが安全
