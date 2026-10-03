# One root per cloud; one STATE per cell (blast radius = one cell, ADR-0002).
#   terraform -chdir=infra/terraform/envs/on-prem init  <backend config>
#   terraform -chdir=infra/terraform/envs/on-prem apply -var-file=cells/<env>-<cell>.tfvars
terraform {
  required_version = ">= 1.6"
}

provider "kubernetes" {
  config_context = var.on_prem_kubeconfig_context
}

module "cell" {
  source = "../../providers/on-prem"

  cell                       = var.cell
  cloud_region               = var.cloud_region
  environment                = var.environment
  name_prefix                = var.name_prefix
  kubernetes_version         = var.kubernetes_version
  node_pools                 = var.node_pools
  managed_postgres           = var.managed_postgres
  object_storage             = var.object_storage
  tags                       = var.tags
  on_prem_cluster_endpoint   = var.on_prem_cluster_endpoint
  on_prem_kubeconfig_context = var.on_prem_kubeconfig_context
  on_prem_s3_endpoint        = var.on_prem_s3_endpoint
}

output "cell" {
  value = module.cell
}
