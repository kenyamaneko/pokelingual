# ADR-033: Terraform plan を CI 必須化し、apply は引き続きローカル手動に限定する

## ステータス

Accepted

## 結論

PR で `terraform/` に差分があるとき、`terraform plan` (dev) を `terraform fmt` と同様に required status check にし、plan が失敗・未実行のままではマージできないようにする。この plan は dev 環境の tfvars・backend のみを検証しており、prod 固有の差分は対象外。一方 `terraform apply` は CI 化せず、これまで通り人がローカルで実行する運用を維持する。

## 背景・課題

`terraform plan` を PR 上で可視化する仕組み (#127) はすでにあったが、required status check には入っておらず、plan が失敗・未実行のままでもマージできた。fmt チェックと同じ扱いにすることで、terraform に差分のある PR は plan の成功をマージ条件にする。

apply の CI 化も合わせて検討したが、見送った (不採用案を参照)。

## 不採用案

- **apply も `workflow_dispatch` で CI 実行する**：main.tf は IAM バインディング自体・WIF 自身の信頼設定・API 有効化・Monitoring・Billing budget・Firebase 設定まで管理しており、これを apply できる SA には、ほぼ owner 相当の権限を GitHub Actions から到達可能な形で持たせる必要がある。既存の読み取り専用 plan SA (`terraform_plan`) や、IAM を触らない書き込み用 deploy SA (`github_actions`) と異なり、この SA は自身の WIF 信頼設定まで変更できてしまうため、自己昇格が可能な経路になる。ソロ運用ではローカルで人が `terraform apply` を打つという操作自体がすでに「意図せず apply が実行される」ことを防いでおり、この追加リスクに見合わないため見送った。
