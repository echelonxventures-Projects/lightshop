output "cell" {
  value = var.cell
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --region ${var.cloud_region} --name ${module.eks.cluster_name}"
}

output "postgres_endpoint" {
  value = var.managed_postgres.enabled ? aws_db_instance.postgres[0].endpoint : null
}

output "object_storage_endpoint" {
  value = var.object_storage.enabled ? "https://s3.${var.cloud_region}.amazonaws.com" : null
}

output "object_storage_bucket" {
  value = var.object_storage.enabled ? aws_s3_bucket.media[0].bucket : null
}

output "argocd_cluster_labels" {
  value = local.argocd_cluster_labels
}
