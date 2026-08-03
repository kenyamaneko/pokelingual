# ============================================================
# Billing Budget アラート
# ============================================================
# アプリ層レートリミット（per-user/global の AI 呼び出し上限）が「実質的な上限装置」。
# このリソースは「想定外コストの早期検知」のためのメール通知で、自動停止は行わない。
# Billing 通知は数時間〜半日遅延あり、自動停止は実害を完全には防げないため。

data "google_project" "current" {
  count      = var.billing_account_id != "" ? 1 : 0
  project_id = var.project_id
}

resource "google_billing_budget" "monthly" {
  count = var.billing_account_id != "" ? 1 : 0

  billing_account = "billingAccounts/${var.billing_account_id}"
  display_name    = "pokelingual-${var.environment}-budget"

  # budget_filter.projects は projects/PROJECT_NUMBER 形式（PROJECT_ID ではない）
  budget_filter {
    projects = ["projects/${data.google_project.current[0].number}"]
  }

  amount {
    specified_amount {
      currency_code = "JPY"
      units         = var.monthly_budget_jpy
    }
  }

  threshold_rules {
    threshold_percent = 0.05
  }
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    monitoring_notification_channels = google_monitoring_notification_channel.email[*].id
  }

  depends_on = [google_project_service.apis]
}
