variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
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
