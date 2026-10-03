# Contract every provider implementation must output. ArgoCD/Helm consume only these.
output "kubeconfig" {
  value     = null
  sensitive = true
  description = "Kubeconfig for the cell cluster (implemented by providers/<cloud>)."
}

output "postgres_endpoint" {
  value       = null
  description = "host:port of the regional Postgres (managed or operator-run)."
}

output "object_storage_endpoint" {
  value       = null
  description = "S3-compatible endpoint URL for the cell."
}
