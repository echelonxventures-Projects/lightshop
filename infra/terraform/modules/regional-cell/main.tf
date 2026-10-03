# Interface module: intentionally provider-free. See providers/<cloud>/ for implementations.
locals {
  labels = {
    "lightshop-region" = var.region_code
    "lightshop-env"    = var.environment
    "data-residency"   = var.region_code
  }
}
