variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
}

variable "environment" {
  description = "Environment name (dev or prod)"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be 'dev' or 'prod'."
  }
}

variable "pitr_enabled" {
  description = "Whether to enable Point-in-Time Recovery on the Firestore database"
  type        = bool
}

variable "alerts_enabled" {
  description = "Whether to create Cloud Monitoring alert policies for the backend service"
  type        = bool
}

variable "firebase_web_app_display_name" {
  description = "Display name for the Firebase web app"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository in owner/repo format (e.g. kenyamaneko/pokelingual)"
  type        = string
}

variable "alert_email" {
  description = "Email address for Cloud Monitoring alert notifications"
  type        = string
}

# Slack 通知チャネルは OAuth 認可が必要で Terraform から作成できないため、手動作成したリソース名を受け取る。
variable "slack_notification_channel_id" {
  description = "Resource name of a manually created Slack notification channel. Leave empty to skip Slack notifications."
  type        = string
}

# 請求アカウントの表示名。空文字なら Billing Budget は作成しない。
# 作成には Terraform 実行者が billing.budgets.create 権限を請求アカウントレベルで持つ必要あり
variable "billing_account_display_name" {
  description = "Google Cloud billing account display name. Leave empty to skip Billing Budget creation."
  type        = string
}

variable "monthly_budget_jpy" {
  description = "Monthly budget cap in JPY. Alerts fire at 50/80/100% of this amount."
  type        = number
}
