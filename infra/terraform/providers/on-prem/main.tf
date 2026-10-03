# On-prem / any existing Kubernetes: the cluster, network and storage already exist. This implementation
# prepares the cell (namespace + residency labels) and runs every dependency in-cluster via ArgoCD.
locals {
  name = "${var.name_prefix}-${var.environment}-${var.cell}"
}

resource "kubernetes_namespace" "lightshop" {
  metadata {
    name = "lightshop"
    labels = merge(var.tags, {
      "lightshop/cell"        = var.cell
      "lightshop/environment" = var.environment
      "lightshop/location"    = replace(var.cloud_region, "/[^a-zA-Z0-9-_.]/", "-")
    })
  }
}
