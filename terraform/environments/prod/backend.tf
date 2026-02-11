terraform {
  backend "gcs" {
    bucket = "pokelingual-prod-tfstate"
    prefix = "terraform/state"
  }
}
