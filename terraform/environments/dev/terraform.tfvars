project_id  = "pokelingual-dev"
environment = "dev"
region      = "asia-northeast1"

# dev は使い捨てデータのため PITR は無効。動作確認・テストでエラーパスを意図的に踏むため
# アラートポリシーも作らない。
pitr_enabled   = false
alerts_enabled = false

firebase_web_app_display_name = "PokeLingual"
github_repo                   = "kenyamaneko/pokelingual"
alert_email                   = "kenya.m.amaoto@gmail.com"

slack_notification_channel_id = "projects/pokelingual-dev/notificationChannels/1557874482673255254"

# 請求アカウントの表示名。空文字なら Billing Budget を作成しない。
# 実際に Budget を運用している場合は請求アカウントの表示名を設定すること
# (空のまま apply すると既存の Budget が削除される)。
billing_account_display_name = ""
monthly_budget_jpy           = 5000
