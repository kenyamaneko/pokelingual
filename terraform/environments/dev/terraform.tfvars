project_id  = "pokelingual-dev"
environment = "dev"
region      = "asia-northeast1"

# dev は使い捨てデータのため PITR は無効。動作確認・テストでエラーパスを意図的に踏むため
# アラートポリシーも作らない。
pitr_enabled   = false
alerts_enabled = false

# dev 環境を意図せず部外者に利用されないようにするため
disable_new_user_signup = true

# dev は新規登録自体を止めているためサインアップスモークを実行できない
signup_smoke_enabled = false

firebase_web_app_display_name = "Pokelingual"
github_repo                   = "kenyamaneko/pokelingual"
alert_email                   = "kenya.m.amaoto@gmail.com"

# alerts_enabled = false のためどのアラートにも紐付かず未使用
slack_notification_channel_id = ""

billing_account_id = "019A0B-9A103A-B4C602"
monthly_budget_jpy = 5000

max_instance_count = 1
