# Remote state per cell: terraform init -backend-config="resource_group_name=..." -backend-config="storage_account_name=..." -backend-config="container_name=tfstate" -backend-config="key=lightshop/<env>/<cell>.tfstate"
terraform {
  backend "azurerm" {}
}
