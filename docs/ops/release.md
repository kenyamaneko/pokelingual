# リリース手順とデプロイ後の検証

dev への反映、prod へのリリース、デプロイ後の検証の手順。バージョンアップの種類の選び方は、リポ固有のルールに従う。

## dev への反映

feature ブランチの PR を `main` にマージする。マージで「Deploy to Dev」が自動で実行される。実行の流れは次のとおり。

1. 共有 CI (lint・テスト・E2E) を実行する。通らなければ以降は実行されない。
2. backend を Cloud Run へデプロイする。
3. dev のスモークを実行する。
4. frontend を Firebase Hosting へデプロイする。
5. スモークの成功と frontend のデプロイを待って、dev に対するシナリオテストを実行する。

`**.md`・`docs/**`・`rules/**`・`.claude/**`・`.vscode/**` のみを変更したマージでは実行されない。手動で実行するときは、GitHub Actions の「Deploy to Dev」から「Run workflow」で `main` を選ぶ。

dev の画面に表示されるバージョンは、`git describe --tags --always` の結果になる。最新のバージョンタグから N コミット先なら `v1.0.0-N-g<sha>` と表示される。

## prod へのリリース

1. リリースする `main` の最新コミットについて、「Deploy to Dev」が成功していることを確認する。prod へのデプロイではテストを実行しないため、検証は dev で済ませておく。

   ```bash
   gh run list --workflow deploy-dev.yml --branch main --limit 3
   ```

2. `main` で「Deploy to Prod」を実行する。バージョンアップの種類 `bump` は `patch`・`minor`・`major` から選ぶ。

   ```bash
   gh workflow run deploy-prod.yml --ref main -f bump=patch   # patch / minor / major
   ```

   GitHub の画面から実行するときは、Actions → Deploy to Prod → Run workflow で、「Use workflow from」に `main` を、「Version bump level」に種類を選ぶ。

3. 実行が成功するまで待つ。

   ```bash
   gh run list --workflow deploy-prod.yml --limit 1
   ```

4. 打たれたバージョンタグを確認する。

   ```bash
   git fetch --tags && git tag --sort=-v:refname | head -1
   ```

実行の流れは次のとおり。

1. `Tag Version` ジョブが、keyandnotes-tools の再利用ワークフロー `create-version-tag.yml` を呼ぶ。リモートのバージョンタグ (`vX.Y.Z`) のうち最大のものから、選んだ種類で上げた次のタグを求め、実行したコミットに打つ。
2. backend を、タグを打ったコミットから prod 用にビルドし、Cloud Run へデプロイする。イメージにはコミットの SHA とバージョンタグを付ける。
3. prod のスモークを実行する。
4. frontend を、prod の環境値とバージョンタグでビルドし、Firebase Hosting へデプロイする。frontend のデプロイは、スモークの結果を待たず、backend のデプロイ後すぐ始まる。

### main 以外で実行したとき

`Tag Version` ジョブがスキップされ、後続のデプロイのジョブもスキップされる。`main` を選び直して実行する。

### 最初のバージョンタグ

再利用ワークフローは、リモートにバージョンタグが 1 つも無いと失敗する。バージョンタグが無いリポでは、最初のタグを手で打ってから「Deploy to Prod」を実行する。

```bash
git tag v1.0.0 <main のコミット>
git push origin v1.0.0
```

### デプロイが途中で失敗したとき

`Tag Version` が成功した後に失敗すると、タグはすでに打たれている。同じ実行の「Re-run failed jobs」で失敗したジョブだけを再実行すると、同じタグとコミットのまま続きを実行できる。「Deploy to Prod」を新たに実行すると、次のバージョンのタグが打たれる。

リリース後に不具合が発覚したときの切り戻しは[ロールバック手順](rollback-prod.md)に従う。

## デプロイ後の検証

dev と prod のデプロイ後に、デプロイ済みの環境に対してスモークを実行する。スモークは検出専用で、失敗しても自動でロールバックしない。スモークは、`scripts` のシェルスクリプトを、ワークフローがデプロイ済みの Cloud Run サービスの URL に対して実行する。

### dev

「Deploy to Dev」の `Smoke Test (dev)` ジョブが、次の 2 本を順に実行する。

| ステップ | 確かめること |
|---|---|
| `Run smoke test` | `/health` が 200 を返す (コールドスタートと IAM の反映待ちのため、5 秒間隔で最大 12 回試す)。フィクスチャユーザーでサインインし、`/api/usage` が 200 を返す |
| `Run quest smoke test` | フィクスチャユーザーで、クエストの発行 → 実 Gemini での採点 → ボール種別の決定 → 捕獲 (Firestore への書き込み) を 1 周する |

クエストのスモークは、フィクスチャユーザーのレート制限の回数を消費し、図鑑にデータを残す。後始末はしない。

スモークの後、frontend のデプロイとあわせて `Scenario Tests with Real Services (dev)` ジョブが、`https://pokelingual-dev.web.app` に対して Playwright のシナリオテストを実行する。スモークが失敗すると、このジョブは実行されない。

### prod

「Deploy to Prod」の `Smoke Test (prod)` ジョブが、次の 2 本を順に実行する。

| ステップ | 確かめること |
|---|---|
| `Run smoke test` | dev と同じスクリプトで、`/health` が 200 を返し、フィクスチャユーザーでサインインして `/api/usage` が 200 を返す |
| `Run signup smoke test` | 使い捨てユーザー (`smoke-signup+<実行 ID>@pokelingual.dev`) で、新規登録 → Admin API でメール確認済みに更新 → サインイン → `/api/usage` が 200 を返す、を通す |

prod のレート制限は実ユーザーと共有するため、クエスト (Gemini) の経路は実行しない。使い捨てユーザーは実行の最後に削除する。削除に失敗しても警告 (`WARN: failed to delete test user`) をログに出すだけで、スモークの結果は変わらない。警告が出たら、実行 ID を含むメールのユーザーを Firebase Console の Authentication から削除する。

### 失敗したときに見る場所

1. GitHub の Actions で、失敗した実行を開き、失敗したジョブ (`Smoke Test (dev)`・`Smoke Test (prod)`・`Scenario Tests with Real Services (dev)`) の失敗したステップのログを読む。スモークの失敗は `FAIL:` で始まる行に出る。

   | `FAIL:` の内容 | 疑う原因 |
   |---|---|
   | `/health did not return 200` | デプロイした新リビジョンが起動していない、または公開アクセスの IAM が外れている |
   | `could not sign in fixture user` | フィクスチャユーザーが無い、メール確認済みでない、またはパスワードが違う |
   | `GET /api/usage returned <ステータス>` | backend の認証の設定。ステータスが 403 なら、メール確認済みでないトークンを疑う |
   | `signUp did not return a localId` | prod の新規登録が無効になっている |
   | `/api/quest/...` が期待した項目を返さない | Gemini・Firestore・レート制限カウンターの配線 |

2. backend 側の原因は Cloud Run のログで調べる。コマンドは[アラート対応と緊急停止の手順](emergency-response.md)の「共通の初動」にある。
3. シナリオテストが失敗したときは、実行の成果物 `scenario-dev-real-results` (7 日間保持) にテスト結果がある。
4. prod のスモークが失敗したら、利用者への影響を確認し、直せなければ[ロールバック手順](rollback-prod.md)で切り戻す。
