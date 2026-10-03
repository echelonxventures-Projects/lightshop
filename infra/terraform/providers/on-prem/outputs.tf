output "cell" {
  value = var.cell
}

output "cluster_name" {
  value = var.on_prem_kubeconfig_context
}

output "cluster_endpoint" {
  value = var.on_prem_cluster_endpoint
}

output "kubeconfig_command" {
  value = "kubectl config use-context ${var.on_prem_kubeconfig_context}"
}

# Managed Postgres doesn't exist on-prem: CloudNativePG runs in-cluster (labels below enable it).
output "postgres_endpoint" {
  value = null
}

output "object_storage_endpoint" {
  value = var.object_storage.enabled && var.on_prem_s3_endpoint != "" ? var.on_prem_s3_endpoint : null
}

output "object_storage_bucket" {
  value = var.object_storage.enabled && var.on_prem_s3_endpoint != "" ? "${local.name}-media" : null
}

output "argocd_cluster_labels" {
  value = merge(local.argocd_cluster_labels, { "lightshop/dep-cloudnative-pg" = "in-cluster" })
}
