project_id  = "pokelingual-prod"
environment = "prod"
region      = "asia-northeast1"

firebase_web_app_display_name = "PokeLingual"
github_repo                   = "kenyamaneko/pokelingual"
alert_email                   = "kenya.m.amaoto@gmail.com"

slack_notification_channel_id = "projects/pokelingual-prod/notificationChannels/6947893051547836001"

# 請求アカウントの表示名。空文字なら Billing Budget を作成しない。
# 実際に Budget を運用している場合は請求アカウントの表示名を設定すること
# (空のまま apply すると既存の Budget が削除される)。
billing_account_display_name = ""
monthly_budget_jpy           = 5000
