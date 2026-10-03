output "cell" {
  value = var.cell
}

output "cluster_name" {
  value = google_container_cluster.cell.name
}

output "cluster_endpoint" {
  value = "https://${google_container_cluster.cell.endpoint}"
}

output "kubeconfig_command" {
  value = "gcloud container clusters get-credentials ${google_container_cluster.cell.name} --region ${var.cloud_region} --project ${var.gcp_project}"
}

output "postgres_endpoint" {
  value = var.managed_postgres.enabled ? "${google_sql_database_instance.postgres[0].private_ip_address}:5432" : null
}

# GCS speaks the S3 API through its XML interoperability endpoint (HMAC keys).
output "object_storage_endpoint" {
  value = var.object_storage.enabled ? "https://storage.googleapis.com" : null
}

output "object_storage_bucket" {
  value = var.object_storage.enabled ? google_storage_bucket.media[0].name : null
}

output "argocd_cluster_labels" {
  value = local.argocd_cluster_labels
}
