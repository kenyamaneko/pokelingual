output "cloud_run_url" {
  description = "Backend API URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "artifact_registry_repo" {
  description = "Docker image repository"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}"
}

output "service_account_email" {
  description = "Backend service account email"
  value       = google_service_account.backend.email
}
