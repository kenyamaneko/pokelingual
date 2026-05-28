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

# ============================================================
# Enable required APIs
# ============================================================
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
  ])

  service            = each.value
  disable_on_destroy = false
}

# ============================================================
# Firebase
# ============================================================
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

# ============================================================
# Firestore
# ============================================================
resource "google_firestore_database" "default" {
  provider    = google-beta
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}

# Firestore security rules
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

# Firestore composite index for collection query
resource "google_firestore_index" "user_pokemon_captured" {
  provider   = google-beta
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "pokemon"

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }

  fields {
    field_path = "pokemon_id"
    order      = "ASCENDING"
  }

  depends_on = [google_firestore_database.default]
}

# ============================================================
# Firebase Authentication
# ============================================================
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

# Google Sign-In プロバイダ。client_id/secret が空なら無効化し、設定済みなら有効化する
resource "google_identity_platform_default_supported_idp_config" "google" {
  count = var.google_oauth_client_id != "" ? 1 : 0

  provider      = google-beta
  project       = var.project_id
  idp_id        = "google.com"
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret
  enabled       = true

  depends_on = [google_identity_platform_config.auth]
}

# ============================================================
# Artifact Registry (for Docker images)
# ============================================================
resource "google_artifact_registry_repository" "backend" {
  provider      = google-beta
  project       = var.project_id
  location      = var.region
  repository_id = "pokelingual-backend"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# ============================================================
# Cloud Run (Backend API)
# ============================================================
# NOTE: Cloud Run service is created by the first `gcloud run deploy` in GitHub Actions.
# After the first deploy, run the following to allow public access:
#   gcloud run services add-iam-policy-binding pokelingual-api-${environment} \
#     --region=asia-northeast1 --member="allUsers" --role="roles/run.invoker" \
#     --project=${project_id}

# ============================================================
# Service Account for Backend
# ============================================================
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

# ============================================================
# Workload Identity Federation (GitHub Actions → GCP)
# ============================================================
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

# Service account for GitHub Actions deploy
resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "github-actions-deploy"
  display_name = "GitHub Actions Deploy (${var.environment})"
}

# Allow GitHub Actions to impersonate the deploy service account
resource "google_service_account_iam_member" "github_actions_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# Grant deploy SA permissions to push to Artifact Registry
resource "google_project_iam_member" "github_actions_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Grant deploy SA permissions to deploy Cloud Run
# roles/run.admin is required (not run.developer) because --allow-unauthenticated
# needs run.services.setIamPolicy permission to grant allUsers the invoker role.
resource "google_project_iam_member" "github_actions_cloud_run" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Grant deploy SA permissions to act as the backend service account (required for Cloud Run deploy)
resource "google_service_account_iam_member" "github_actions_act_as_backend" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions.email}"
}

# Grant deploy SA permissions to read/write Firestore
# Required for integration tests: managing test user's allowed_emails in config/auth
# and cleaning up test data (users/{uid}/pokemon/*)
resource "google_project_iam_member" "github_actions_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Grant deploy SA permissions to deploy Firebase Hosting
resource "google_project_iam_member" "github_actions_firebase_hosting" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# ============================================================
# Cloud Monitoring
# ============================================================

# Email notification channel
resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "PokeLingual Alert Email (${var.environment})"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis]
}

# Alert: Cloud Run error rate (5xx responses)
resource "google_monitoring_alert_policy" "cloud_run_error_rate" {
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

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    auto_close = "604800s"
  }

  depends_on = [google_project_service.apis]
}

# Alert: Cloud Run high latency (p95 > 10s)
resource "google_monitoring_alert_policy" "cloud_run_latency" {
  project      = var.project_id
  display_name = "Cloud Run High Latency (${var.environment})"
  combiner     = "OR"

  conditions {
    display_name = "p95 latency > 10s"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "pokelingual-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_latencies"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 10000
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    auto_close = "604800s"
  }

  depends_on = [google_project_service.apis]
}

# Alert: Application error logs (severity >= ERROR)
resource "google_monitoring_alert_policy" "log_error_count" {
  project      = var.project_id
  display_name = "Application Error Logs (${var.environment})"
  combiner     = "OR"

  conditions {
    display_name = "Error log entries > 10 in 5min"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "pokelingual-api-${var.environment}"
        AND metric.type = "logging.googleapis.com/log_entry_count"
        AND metric.labels.severity = "ERROR"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 10
      duration        = "0s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    auto_close = "604800s"
  }

  depends_on = [google_project_service.apis]
}
