# Cloud Run サービス本体。コンテナの image・env・secrets は Terraform 管理外とし、
# CI の `gcloud run deploy` が引き続き更新する。
resource "google_cloud_run_v2_service" "backend" {
  name     = "pokelingual-api-${var.environment}"
  location = var.region
  project  = var.project_id

  deletion_protection = true
  ingress             = "INGRESS_TRAFFIC_ALL"

  # 未宣言だと API が返す既定値 (0) との間で perma-diff になるため、現状追従の値を明示する
  scaling {
    manual_instance_count = 0
    min_instance_count    = 0
    scaling_mode          = "AUTOMATIC"
  }

  template {
    service_account = google_service_account.backend.email

    scaling {
      max_instance_count = var.max_instance_count
    }

    containers {
      # env・secrets は CI の gcloud run deploy が管理する (ignore_changes 対象なので値は使われない)
      image = "asia-northeast1-docker.pkg.dev/${var.project_id}/pokelingual-backend/api:placeholder"
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[0].env,
    ]
  }

  depends_on = [google_project_service.apis]
}

# Firebase Auth トークンは IAM トークンではないため、IAM 認証を有効なままにすると
# Cloud Run がリクエストを拒否してしまう。アプリレベルの認証は middleware/auth.ts の
# Firebase Auth ミドルウェアが担保する。
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  name     = google_cloud_run_v2_service.backend.name
  location = var.region
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}
