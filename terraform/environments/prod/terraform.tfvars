project_id  = "pokelingual-prod"
environment = "prod"
region      = "asia-northeast1"

pitr_enabled   = true
alerts_enabled = true

# prod は一般公開方針のため新規登録を止めない。
disable_new_user_signup = false

signup_smoke_enabled = true

firebase_web_app_display_name = "PokeLingual"
github_repo                   = "kenyamaneko/pokelingual"
alert_email                   = "kenya.m.amaoto@gmail.com"

slack_notification_channel_id = "projects/pokelingual-prod/notificationChannels/6947893051547836001"

# prod は公開環境の予算超過検知として設定する。
billing_account_display_name = "ken-yamaneko-billing"
monthly_budget_jpy           = 5000
