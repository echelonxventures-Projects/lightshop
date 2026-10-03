output "cell" {
  value = var.cell
}

output "cluster_name" {
  value = azurerm_kubernetes_cluster.cell.name
}

output "cluster_endpoint" {
  value = azurerm_kubernetes_cluster.cell.fqdn
}

output "kubeconfig_command" {
  value = "az aks get-credentials --resource-group ${azurerm_resource_group.cell.name} --name ${azurerm_kubernetes_cluster.cell.name}"
}

output "postgres_endpoint" {
  value = var.managed_postgres.enabled ? "${azurerm_postgresql_flexible_server.postgres[0].fqdn}:5432" : null
}

# Azure Blob is not S3-API: use an Azure ObjectStorage adapter (libs/adapters port) or an S3 gateway in front of it.
output "object_storage_endpoint" {
  value = var.object_storage.enabled ? azurerm_storage_account.media[0].primary_blob_endpoint : null
}

output "object_storage_bucket" {
  value = var.object_storage.enabled ? azurerm_storage_container.media[0].name : null
}

output "argocd_cluster_labels" {
  value = local.argocd_cluster_labels
}
