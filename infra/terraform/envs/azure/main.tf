# One root per cloud; one STATE per cell (blast radius = one cell, ADR-0002).
#   terraform -chdir=infra/terraform/envs/azure init  <backend config>
#   terraform -chdir=infra/terraform/envs/azure apply -var-file=cells/<env>-<cell>.tfvars
terraform {
  required_version = ">= 1.6"
}

provider "azurerm" {
  features {}
}

module "cell" {
  source = "../../providers/azure"

  cell               = var.cell
  cloud_region       = var.cloud_region
  environment        = var.environment
  name_prefix        = var.name_prefix
  kubernetes_version = var.kubernetes_version
  node_pools         = var.node_pools
  managed_postgres   = var.managed_postgres
  object_storage     = var.object_storage
  tags               = var.tags
  azure_vnet_cidr    = var.azure_vnet_cidr
}

output "cell" {
  value = module.cell
}
