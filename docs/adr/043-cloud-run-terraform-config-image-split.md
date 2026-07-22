# ADR-043: Cloud Run サービス本体を Terraform 管理にし、image と env/secrets は CI に残す

## ステータス

Accepted

## 結論

Cloud Run サービス本体 (`google_cloud_run_v2_service`) を、IAM・WIF・予算まで管理する既存 state (`main.tf`) と同じ state に `terraform/cloud_run.tf` として追加する。state は分離しない。

max-instances・traffic・invoker (公開アクセス)・実行サービスアカウント・deletion_protection は Terraform の属性へ移す。コンテナの **image** と **env (secrets 含む)** は Terraform 管理外とし、これまで通り CI の `gcloud run deploy` が更新する。apply は他リソースと同じく人がローカルで手動実行し、CI からの自動 apply は導入しない (ADR-033 を維持)。

## 背景・課題

Cloud Run サービス本体はこれまで Terraform では作らず、GitHub Actions の `gcloud run deploy` がコミットのたびに作成・更新していた。`--max-instances` 等のランタイム設定も、この `gcloud run deploy` のフラグとして CI yaml に直書きされていた。Issue #201 のロールアウト作業で `--max-instances` を引き上げる際、宣言的であるべき設定を CI yaml の編集で変更することに違和感が生じた (Issue #213)。

ADR-033 により、`main.tf` の state に対する `terraform apply` は CI 化していない。この state に apply 権限を持つ SA を持たせると自己昇格の経路になるため。Cloud Run サービス本体を同じ state に含めても、この制約は変わらない。コンテナ image はコミットのたびに更新が必須で、Terraform 管理にすると apply の CI 化が避けられず、この制約と衝突する。

env についても、作業中に並行マージされた Issue #211 (PR #212) がクエスト・捕獲のチューニングパラメータを CI 管理の env へ追加した。これらは mock/real を問わず起動時に必須で、未設定だと例外で落ちる。Cloud Run の env はコンテナごとに単一のリストで、Terraform と CI とで部分的に所有権を分けられないため、Terraform 側の宣言から一つでも漏れると次の apply で新リビジョンが起動に失敗する。

## 不採用案

- **image を含め Cloud Run サービス全体を Terraform 管理にし、CI から apply を実行する**：apply の CI 化と自己昇格リスクの受容が必要になり、ADR-033 の「apply は手動」と衝突するため見送った。
- **env・secrets も Terraform 管理にする**：CI 側の env 変更源を完全に排除しない限り Terraform の宣言と競合し、抜け漏れが新リビジョンの起動失敗に直結する。個人開発の運用負荷とヒューマンエラーリスクが、env まで宣言化する効用を上回ると判断し見送った。

## Amendment: 2026-07-21 CI が渡す env の置き場所

env を CI 管理とする決定は維持したうえで、値の性質ごとに置き場所を分ける。デプロイ先を表す識別子は GitHub Environment 変数に、環境によらず共通のサービス実行設定と環境ごとに異なる運用値はそれぞれリポジトリ内の設定ファイルに置き、CI が合成して Cloud Run へ渡す。デプロイ定義の1行に性質の異なる値が混在する状態を解消し、値の変更を PR レビューに載せるため。
