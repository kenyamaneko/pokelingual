# Cloud Run サービス本体。image のみ Terraform 管理外とし、CI の `gcloud run deploy --image` が
# コミットのたびに更新する。
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
      # import 後は ignore_changes 対象なので値は使われない
      image = "asia-northeast1-docker.pkg.dev/${var.project_id}/pokelingual-backend/api:placeholder"

      env {
        name  = "APP_MODE"
        value = "real"
      }
      env {
        name  = "APP_ENV"
        value = var.environment
      }
      env {
        name  = "GEMINI_MODEL"
        value = "gemini-2.5-flash"
      }
      env {
        name  = "FRONTEND_URL"
        value = "https://pokelingual-${var.environment}.web.app"
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = "us-central1"
      }
      env {
        name  = "PER_USER_DAILY_LIMIT"
        value = "30"
      }
      env {
        name  = "GLOBAL_DAILY_LIMIT"
        value = "1500"
      }
      env {
        name  = "POKEMON_SNAPSHOT_URI"
        value = "gs://${var.project_id}-pokemon-snapshot/pokemon-snapshot.json"
      }
      env {
        name  = "QUEST_SESSION_TTL_SECONDS"
        value = "3600"
      }
      env {
        name = "UPSTASH_REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.quest_session_redis_url.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
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
