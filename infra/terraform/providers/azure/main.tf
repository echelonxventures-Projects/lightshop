locals {
  name       = "${var.name_prefix}-${var.environment}-${var.cell}"
  short_name = substr(replace("${var.name_prefix}${var.environment}${var.cell}", "-", ""), 0, 20)
  tags       = merge(var.tags, { "lightshop-cell" = var.cell, "lightshop-environment" = var.environment, "managed-by" = "terraform" })
  node_sizes = { small = "Standard_D2s_v5", medium = "Standard_D4s_v5", large = "Standard_D8s_v5", xlarge = "Standard_D16s_v5" }
  db_skus    = { small = "GP_Standard_D2ds_v5", medium = "GP_Standard_D4ds_v5", large = "GP_Standard_D8ds_v5", xlarge = "GP_Standard_D16ds_v5" }
  # The first pool is AKS's system pool; the rest become user pools.
  pool_names  = sort(keys(var.node_pools))
  system_pool = local.pool_names[0]
}

resource "azurerm_resource_group" "cell" {
  name     = local.name
  location = var.cloud_region
  tags     = local.tags
}

resource "azurerm_virtual_network" "cell" {
  name                = local.name
  location            = azurerm_resource_group.cell.location
  resource_group_name = azurerm_resource_group.cell.name
  address_space       = [var.azure_vnet_cidr]
  tags                = local.tags
}

resource "azurerm_subnet" "aks" {
  name                 = "aks"
  resource_group_name  = azurerm_resource_group.cell.name
  virtual_network_name = azurerm_virtual_network.cell.name
  address_prefixes     = [cidrsubnet(var.azure_vnet_cidr, 4, 0)]
}

resource "azurerm_subnet" "postgres" {
  name                 = "postgres"
  resource_group_name  = azurerm_resource_group.cell.name
  virtual_network_name = azurerm_virtual_network.cell.name
  address_prefixes     = [cidrsubnet(var.azure_vnet_cidr, 8, 200)]
  delegation {
    name = "postgres"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_kubernetes_cluster" "cell" {
  name                      = local.name
  location                  = azurerm_resource_group.cell.location
  resource_group_name       = azurerm_resource_group.cell.name
  dns_prefix                = local.short_name
  kubernetes_version        = var.kubernetes_version
  oidc_issuer_enabled       = true
  workload_identity_enabled = true
  automatic_upgrade_channel = "patch"
  tags                      = local.tags

  default_node_pool {
    name                 = substr(replace(local.system_pool, "-", ""), 0, 12)
    vm_size              = local.node_sizes[var.node_pools[local.system_pool].instance_size]
    auto_scaling_enabled = true
    min_count            = var.node_pools[local.system_pool].min_nodes
    max_count            = var.node_pools[local.system_pool].max_nodes
    vnet_subnet_id       = azurerm_subnet.aks.id
    zones                = ["1", "2", "3"]
    node_labels          = { "lightshop/pool" = local.system_pool }
  }
  identity {
    type = "SystemAssigned"
  }
  network_profile {
    network_plugin = "azure"
    network_policy = "azure"
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "pools" {
  for_each              = { for k, v in var.node_pools : k => v if k != local.system_pool }
  name                  = substr(replace(each.key, "-", ""), 0, 12)
  kubernetes_cluster_id = azurerm_kubernetes_cluster.cell.id
  vm_size               = local.node_sizes[each.value.instance_size]
  auto_scaling_enabled  = true
  min_count             = each.value.min_nodes
  max_count             = each.value.max_nodes
  vnet_subnet_id        = azurerm_subnet.aks.id
  zones                 = ["1", "2", "3"]
  node_labels           = { "lightshop/pool" = each.key }
  tags                  = local.tags
}

resource "azurerm_private_dns_zone" "postgres" {
  count               = var.managed_postgres.enabled ? 1 : 0
  name                = "${local.short_name}.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.cell.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  count                 = var.managed_postgres.enabled ? 1 : 0
  name                  = "postgres"
  resource_group_name   = azurerm_resource_group.cell.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres[0].name
  virtual_network_id    = azurerm_virtual_network.cell.id
}

resource "azurerm_postgresql_flexible_server" "postgres" {
  count                         = var.managed_postgres.enabled ? 1 : 0
  name                          = local.name
  resource_group_name           = azurerm_resource_group.cell.name
  location                      = azurerm_resource_group.cell.location
  version                       = var.managed_postgres.version
  sku_name                      = local.db_skus[var.managed_postgres.instance_size]
  storage_mb                    = 131072
  backup_retention_days         = min(var.managed_postgres.backup_days, 35)
  delegated_subnet_id           = azurerm_subnet.postgres.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres[0].id
  public_network_access_enabled = false
  zone                          = "1"
  tags                          = local.tags
  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
  }
  dynamic "high_availability" {
    for_each = var.managed_postgres.high_available ? [1] : []
    content {
      mode = "ZoneRedundant"
    }
  }
  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]
}

resource "azurerm_storage_account" "media" {
  count                           = var.object_storage.enabled ? 1 : 0
  name                            = substr("${local.short_name}media", 0, 24)
  resource_group_name             = azurerm_resource_group.cell.name
  location                        = azurerm_resource_group.cell.location
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  tags                            = local.tags
  blob_properties {
    versioning_enabled = var.object_storage.versioning
  }
}

resource "azurerm_storage_container" "media" {
  count              = var.object_storage.enabled ? 1 : 0
  name               = "media"
  storage_account_id = azurerm_storage_account.media[0].id
}
