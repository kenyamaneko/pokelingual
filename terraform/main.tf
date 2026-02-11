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
  project = var.project_id
  region  = var.region
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
    "generativelanguage.googleapis.com",
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
      enabled           = false
      password_required = false
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_identity_platform_default_supported_idp_config" "google" {
  provider = google-beta
  project  = var.project_id
  idp_id   = "google.com"

  client_id     = ""
  client_secret = ""

  enabled = true

  depends_on = [google_identity_platform_config.auth]

  lifecycle {
    ignore_changes = [client_id, client_secret]
  }
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
resource "google_cloud_run_v2_service" "backend" {
  provider = google-beta
  project  = var.project_id
  name     = "pokelingual-api-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/pokelingual-backend/api:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      env {
        name  = "FRONTEND_URL"
        value = var.environment == "prod" ? "https://pokelingual.web.app" : "https://pokelingual-dev.web.app"
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = var.environment == "prod" ? "1" : "1"
          memory = var.environment == "prod" ? "512Mi" : "256Mi"
        }
      }
    }

    scaling {
      min_instance_count = var.environment == "prod" ? 1 : 0
      max_instance_count = var.environment == "prod" ? 10 : 2
    }

    service_account = google_service_account.backend.email
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.backend,
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

# Allow unauthenticated access to Cloud Run (Firebase Auth handles app-level auth)
resource "google_cloud_run_v2_service_iam_member" "public" {
  provider = google-beta
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

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

# ============================================================
# Secret Manager (Gemini API Key)
# ============================================================
resource "google_secret_manager_secret" "gemini_api_key" {
  provider  = google-beta
  project   = var.project_id
  secret_id = "gemini-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "backend_secret_access" {
  provider  = google-beta
  project   = var.project_id
  secret_id = google_secret_manager_secret.gemini_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}
