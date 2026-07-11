terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

resource "google_project_service" "apis" {
  for_each = toset([
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "aiplatform.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "billingbudgets.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_firebase_web_app" "frontend" {
  provider     = google-beta
  project      = var.project_id
  display_name = "${var.firebase_web_app_display_name} (${var.environment})"

  depends_on = [google_firebase_project.default]
}

data "google_firebase_web_app_config" "frontend" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.frontend.app_id
}

resource "google_firestore_database" "default" {
  provider    = google-beta
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}

resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = <<-EOT
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // Users can only access their own data
            match /users/{userId}/{document=**} {
              allow read, write: if request.auth != null && request.auth.uid == userId;
            }
            // Deny all other access
            match /{document=**} {
              allow read, write: if false;
            }
          }
        }
      EOT
    }
  }

  depends_on = [google_firestore_database.default]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name

  depends_on = [google_firebaserules_ruleset.firestore]
}

resource "google_identity_platform_config" "auth" {
  provider = google-beta
  project  = var.project_id

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }
  }

  depends_on = [google_project_service.apis]
}

# Google Sign-In (google.com IdP) の有効化は Terraform 管理外。
# client_secret を TF 変数経由で渡すと tfstate に平文で残り iac.md に反するため、
# Google Cloud コンソール/gcloud で設定する (ADR-012 参照)。

resource "google_artifact_registry_repository" "backend" {
  provider      = google-beta
  project       = var.project_id
  location      = var.region
  repository_id = "pokelingual-backend"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# Cloud Run サービス本体は Terraform では作らず、GitHub Actions の初回 `gcloud run deploy` が作成する。
# 初回デプロイ後に公開アクセスを許可するには以下を実行する:
#   gcloud run services add-iam-policy-binding pokelingual-api-${environment} \
#     --region=asia-northeast1 --member="allUsers" --role="roles/run.invoker" \
#     --project=${project_id}

resource "google_service_account" "backend" {
  project      = var.project_id
  account_id   = "pokelingual-api-${var.environment}"
  display_name = "PokeLingual API (${var.environment})"
}

resource "google_project_iam_member" "backend_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_firebase_auth" {
  project = var.project_id
  role    = "roles/firebaseauth.viewer"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_vertex_ai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "github-actions-deploy"
  display_name = "GitHub Actions Deploy (${var.environment})"
}

resource "google_service_account_iam_member" "github_actions_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

resource "google_project_iam_member" "github_actions_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# --allow-unauthenticated で allUsers に invoker を付与するには run.services.setIamPolicy が
# 必要なため、run.developer ではなく run.admin を使う。
resource "google_project_iam_member" "github_actions_cloud_run" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Cloud Run のデプロイでは実行サービスアカウント (backend) への actAs が要求されるため付与する。
resource "google_service_account_iam_member" "github_actions_act_as_backend" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

# 統合テストが config/auth の allowed_emails 管理とテストデータ (users/{uid}/pokemon/*) の
# 掃除を行うため、deploy SA に Firestore の読み書きを許可する。
resource "google_project_iam_member" "github_actions_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_firebase_hosting" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "PokeLingual Alert Email (${var.environment})"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis]
}

locals {
  alert_notification_channels = concat(
    [google_monitoring_notification_channel.email.id],
    var.slack_notification_channel_id != "" ? [var.slack_notification_channel_id] : [],
  )
}

# prod に既存適用済みのリソースへ count を追加するとアドレスが [0] 付きに変わるため、
# moved block なしでは destroy + recreate になってしまう。
moved {
  from = google_monitoring_alert_policy.cloud_run_error_rate
  to   = google_monitoring_alert_policy.cloud_run_error_rate[0]
}

moved {
  from = google_monitoring_alert_policy.cloud_run_latency
  to   = google_monitoring_alert_policy.cloud_run_latency[0]
}

moved {
  from = google_monitoring_alert_policy.log_error_count
  to   = google_monitoring_alert_policy.log_error_count[0]
}

# Dev は動作確認・テストでエラーパスを意図的に踏むため、アラートポリシー自体を作らず監視を prod に絞る。
resource "google_monitoring_alert_policy" "cloud_run_error_rate" {
  count = var.environment == "prod" ? 1 : 0

  project      = var.project_id
  display_name = "Cloud Run 5xx Error Rate (${var.environment})"
  combiner     = "OR"

  conditions {
    display_name = "5xx error rate > 5 req/s"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "pokelingual-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = local.alert_notification_channels

  alert_strategy {
    auto_close = "604800s"
  }

  depends_on = [google_project_service.apis]
}

resource "google_monitoring_alert_policy" "cloud_run_latency" {
  count = var.environment == "prod" ? 1 : 0

  project      = var.project_id
  display_name = "Cloud Run High Latency (${var.environment})"
  combiner     = "OR"

  conditions {
    display_name = "p95 latency > 5s"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "pokelingual-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_latencies"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 5000
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }

  notification_channels = local.alert_notification_channels

  alert_strategy {
    auto_close = "604800s"
  }

  depends_on = [google_project_service.apis]
}

resource "google_monitoring_alert_policy" "log_error_count" {
  count = var.environment == "prod" ? 1 : 0

  project      = var.project_id
  display_name = "Application Error Logs (${var.environment})"
  combiner     = "OR"

  conditions {
    display_name = "Error log entries > 0 in 5min"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "pokelingual-api-${var.environment}"
        AND metric.type = "logging.googleapis.com/log_entry_count"
        AND metric.labels.severity = "ERROR"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.alert_notification_channels

  alert_strategy {
    auto_close = "604800s"
  }

  depends_on = [google_project_service.apis]
}

resource "google_monitoring_dashboard" "backend" {
  count = 1

  project = var.project_id

  dashboard_json = templatefile("${path.module}/dashboard.json", {
    environment = var.environment
  })

  depends_on = [google_project_service.apis]
}
