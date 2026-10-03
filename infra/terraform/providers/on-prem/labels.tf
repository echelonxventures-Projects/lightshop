locals {
  # Which platform dependencies this cell runs in-cluster (see infra/argocd/platform-deps.yaml).
  argocd_cluster_labels = merge(
    {
      "lightshop/cell"                 = "true"
      "lightshop/region"               = var.cell
      "lightshop/environment"          = var.environment
      "lightshop/platform-manifests"   = "true"
      "lightshop/dep-cert-manager"     = "in-cluster"
      "lightshop/dep-external-secrets" = "in-cluster"
      "lightshop/dep-strimzi"          = "in-cluster"
      "lightshop/dep-temporal"         = "in-cluster"
      "lightshop/dep-otel-collector"   = "in-cluster"
    },
    var.managed_postgres.enabled ? {} : { "lightshop/dep-cloudnative-pg" = "in-cluster" },
  )
}
