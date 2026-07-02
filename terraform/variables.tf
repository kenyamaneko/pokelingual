variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Environment name (dev or prod)"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be 'dev' or 'prod'."
  }
}

variable "firebase_web_app_display_name" {
  description = "Display name for the Firebase web app"
  type        = string
  default     = "PokeLingual"
}

variable "github_repo" {
  description = "GitHub repository in owner/repo format (e.g. kenyamaneko/pokelingual)"
  type        = string
  default     = "kenyamaneko/pokelingual"
}

variable "alert_email" {
  description = "Email address for Cloud Monitoring alert notifications"
  type        = string
  default     = "kenya.m.amaoto@gmail.com"
}

# 請求アカウントの表示名。未設定（空文字）なら Billing Budget は作成しない。
# 作成には Terraform 実行者が billing.budgets.create 権限を請求アカウントレベルで持つ必要あり
variable "billing_account_display_name" {
  description = "Google Cloud billing account display name. Leave empty to skip Billing Budget creation."
  type        = string
  default     = ""
}

variable "monthly_budget_jpy" {
  description = "Monthly budget cap in JPY. Alerts fire at 50/80/100% of this amount."
  type        = number
  default     = 5000
}
