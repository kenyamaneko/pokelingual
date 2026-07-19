# ADR-043: Cloud Run サービス本体を Terraform 管理にし、image のみ CI に残す

## ステータス

Accepted

## 結論

Cloud Run サービス本体 (`google_cloud_run_v2_service`) を、IAM・WIF・予算まで管理する既存 state (`main.tf`) と同じ state に `terraform/cloud_run.tf` として追加する。state は分離しない。

コンテナ **image** だけは `lifecycle { ignore_changes }` で Terraform 管理外とし、これまで通り CI の `gcloud run deploy --image` が更新する。max-instances・env vars・secrets・traffic・invoker (公開アクセス)・実行サービスアカウントは Terraform の属性へ移し、CI yaml から該当フラグを削除する。apply は他リソースと同じく人がローカルで手動実行し、CI からの自動 apply は導入しない (ADR-033 を維持)。

## 背景・課題

Cloud Run サービス本体はこれまで Terraform では作らず、GitHub Actions の `gcloud run deploy` がコミットのたびに作成・更新していた。`--max-instances` 等のランタイム設定も、この `gcloud run deploy` のフラグとして CI yaml に直書きされていた。Issue #201 のロールアウト作業で `--max-instances` を引き上げる際、宣言的であるべき設定を CI yaml の編集で変更することに違和感が生じた (Issue #213)。

ADR-033 により、`main.tf` の state に対する `terraform apply` は CI 化していない。IAM バインディング自体・WIF 自身の信頼設定まで管理する state に apply 権限を持つ SA を持たせると、その SA が自身の WIF 信頼設定を変更できる自己昇格の経路になるため。Cloud Run サービス本体を同じ state に含めても、この制約は変わらない。

一方でコンテナ image はコミットのたびに更新され、CI からの反映が必須である。image まで Terraform 管理にすると apply を CI から自動実行する必要が生じ、上記の自己昇格リスクと衝突する。config (max-instances・env vars・secrets・traffic・invoker) は image ほど更新頻度が高くなく、人の手動 apply でも運用負荷にならない。

## 不採用案

- **image を含め Cloud Run サービス全体を Terraform 管理にし、CI から `terraform apply -var image_tag=$SHA` を実行する**：apply の CI 化と、それに伴う自己昇格リスクの受容が必要になり、ADR-033 の「apply は手動」と衝突するため見送った。
