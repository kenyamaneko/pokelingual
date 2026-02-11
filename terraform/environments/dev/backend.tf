terraform {
  backend "gcs" {
    bucket = "pokelingual-dev-tfstate"
    prefix = "terraform/state"
  }
}
