# ADR-043: Cloud Run サービス本体を Terraform 管理にし、image と env/secrets は CI に残す

## ステータス

Accepted

## 結論

Cloud Run サービス本体 (`google_cloud_run_v2_service`) を、IAM・WIF・予算まで管理する既存 state (`main.tf`) と同じ state に `terraform/cloud_run.tf` として追加する。state は分離しない。

max-instances・traffic・invoker (公開アクセス)・実行サービスアカウント・deletion_protection は Terraform の属性へ移し、CI yaml から該当フラグを削除する。コンテナの **image** と **env (secrets 含む)** は Terraform 管理外とし、これまで通り CI の `gcloud run deploy` が更新する。apply は他リソースと同じく人がローカルで手動実行し、CI からの自動 apply は導入しない (ADR-033 を維持)。

## 背景・課題

Cloud Run サービス本体はこれまで Terraform では作らず、GitHub Actions の `gcloud run deploy` がコミットのたびに作成・更新していた。`--max-instances` 等のランタイム設定も、この `gcloud run deploy` のフラグとして CI yaml に直書きされていた。Issue #201 のロールアウト作業で `--max-instances` を引き上げる際、宣言的であるべき設定を CI yaml の編集で変更することに違和感が生じた (Issue #213)。

ADR-033 により、`main.tf` の state に対する `terraform apply` は CI 化していない。IAM バインディング自体・WIF 自身の信頼設定まで管理する state に apply 権限を持つ SA を持たせると、その SA が自身の WIF 信頼設定を変更できる自己昇格の経路になるため。Cloud Run サービス本体を同じ state に含めても、この制約は変わらない。

コンテナ image はコミットのたびに更新され、CI からの反映が必須である。image まで Terraform 管理にすると apply を CI から自動実行する必要が生じ、上記の自己昇格リスクと衝突する。

env についても、Issue #211 (PR #212) がクエスト・捕獲のチューニングパラメータを `backend/.env.tuning` から CI が合成する `--update-env-vars` へ移した。これらのチューニング値は mock/real を問わず起動時に必須で、未設定だと例外で落ちる。Cloud Run の env はコンテナごとに単一のリストであり、Terraform と CI とで部分的に所有権を分けることができない。Terraform 側の宣言からチューニング値が一つでも漏れると、次の apply で新リビジョンが起動に失敗する。

## 不採用案

- **image を含め Cloud Run サービス全体を Terraform 管理にし、CI から `terraform apply -var image_tag=$SHA` を実行する**：apply の CI 化と、それに伴う自己昇格リスクの受容が必要になり、ADR-033 の「apply は手動」と衝突するため見送った。
- **env・secrets も Terraform 管理にする (`backend/.env.tuning` を `file()` で読み込んで宣言する等)**：Cloud Run の env は単一リストのため、CI 側の変更源を完全に排除しない限り Terraform の宣言と競合し、抜け漏れが新リビジョンの起動失敗に直結する。env の変更を反映するにも `terraform apply` を要し、image 更新 (コミットごとの CI デプロイ) と反映タイミングが分離されるため、新しい env を追加するたびに「先に apply、次に CI デプロイ」という手動の順序調整が必要になる。個人開発の運用負荷とヒューマンエラーリスクが、env まで宣言化する効用を上回ると判断し見送った。
