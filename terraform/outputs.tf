# NOTE: Cloud Run URL is available after first deploy via:
#   gcloud run services describe pokelingual-api-{dev|prod} --region=asia-northeast1 --format="value(status.url)"

output "artifact_registry_repo" {
  description = "Docker image repository"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}"
}

output "service_account_email" {
  description = "Backend service account email"
  value       = google_service_account.backend.email
}

output "wif_provider" {
  description = "Workload Identity Federation provider (set as WIF_PROVIDER in GitHub Environments)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "wif_service_account" {
  description = "Deploy service account email (set as WIF_SERVICE_ACCOUNT in GitHub Environments)"
  value       = google_service_account.github_actions.email
}

output "firebase_api_key" {
  description = "Firebase API Key (set as FIREBASE_API_KEY in GitHub Environments)"
  value       = data.google_firebase_web_app_config.frontend.api_key
  sensitive   = true
}

output "firebase_app_id" {
  description = "Firebase App ID (set as FIREBASE_APP_ID in GitHub Environments)"
  value       = google_firebase_web_app.frontend.app_id
}

output "firebase_messaging_sender_id" {
  description = "Firebase Messaging Sender ID (set as FIREBASE_MESSAGING_SENDER_ID in GitHub Environments)"
  value       = data.google_firebase_web_app_config.frontend.messaging_sender_id
}
