# One root per cloud; one STATE per cell (blast radius = one cell, ADR-0002).
#   terraform -chdir=infra/terraform/envs/aws init  <backend config>
#   terraform -chdir=infra/terraform/envs/aws apply -var-file=cells/<env>-<cell>.tfvars
terraform {
  required_version = ">= 1.6"
}

provider "aws" {
  region = var.cloud_region
  default_tags {
    tags = { "lightshop:cell" = var.cell }
  }
}

module "cell" {
  source = "../../providers/aws"

  cell                   = var.cell
  cloud_region           = var.cloud_region
  environment            = var.environment
  name_prefix            = var.name_prefix
  kubernetes_version     = var.kubernetes_version
  node_pools             = var.node_pools
  managed_postgres       = var.managed_postgres
  object_storage         = var.object_storage
  tags                   = var.tags
  aws_vpc_cidr           = var.aws_vpc_cidr
  aws_availability_zones = var.aws_availability_zones
}

output "cell" {
  value = module.cell
}
