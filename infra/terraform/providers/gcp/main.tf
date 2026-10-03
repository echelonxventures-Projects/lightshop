locals {
  name       = "${var.name_prefix}-${var.environment}-${var.cell}"
  labels     = merge(var.tags, { "lightshop-cell" = var.cell, "lightshop-environment" = var.environment, "managed-by" = "terraform" })
  node_types = { small = "e2-standard-2", medium = "e2-standard-4", large = "n2-standard-8", xlarge = "n2-standard-16" }
  db_tiers   = { small = "db-custom-2-7680", medium = "db-custom-4-15360", large = "db-custom-8-30720", xlarge = "db-custom-16-61440" }
}

resource "google_compute_network" "cell" {
  project                 = var.gcp_project
  name                    = local.name
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "cell" {
  project                  = var.gcp_project
  name                     = local.name
  region                   = var.cloud_region
  network                  = google_compute_network.cell.id
  ip_cidr_range            = var.gcp_subnet_cidr
  private_ip_google_access = true
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.48.0.0/14"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.52.0.0/20"
  }
}

resource "google_compute_router" "cell" {
  project = var.gcp_project
  name    = local.name
  region  = var.cloud_region
  network = google_compute_network.cell.id
}

resource "google_compute_router_nat" "cell" {
  project                            = var.gcp_project
  name                               = local.name
  router                             = google_compute_router.cell.name
  region                             = var.cloud_region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_container_cluster" "cell" {
  project                  = var.gcp_project
  name                     = local.name
  location                 = var.cloud_region
  network                  = google_compute_network.cell.id
  subnetwork               = google_compute_subnetwork.cell.id
  remove_default_node_pool = true
  initial_node_count       = 1
  min_master_version       = var.kubernetes_version
  deletion_protection      = var.environment == "production"
  resource_labels          = local.labels

  release_channel {
    channel = "REGULAR"
  }
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
  workload_identity_config {
    workload_pool = "${var.gcp_project}.svc.id.goog"
  }
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }
  network_policy {
    enabled = true
  }
}

resource "google_container_node_pool" "pools" {
  for_each = var.node_pools
  project  = var.gcp_project
  name     = each.key
  location = var.cloud_region
  cluster  = google_container_cluster.cell.name
  autoscaling {
    total_min_node_count = each.value.min_nodes
    total_max_node_count = each.value.max_nodes
  }
  management {
    auto_repair  = true
    auto_upgrade = true
  }
  node_config {
    machine_type = local.node_types[each.value.instance_size]
    labels       = { "lightshop/pool" = each.key }
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
    shielded_instance_config {
      enable_secure_boot = true
    }
  }
}

# Private IP for Cloud SQL (service networking peering).
resource "google_compute_global_address" "sql" {
  count         = var.managed_postgres.enabled ? 1 : 0
  project       = var.gcp_project
  name          = "${local.name}-sql"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.cell.id
}

resource "google_service_networking_connection" "sql" {
  count                   = var.managed_postgres.enabled ? 1 : 0
  network                 = google_compute_network.cell.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.sql[0].name]
}

resource "google_sql_database_instance" "postgres" {
  count               = var.managed_postgres.enabled ? 1 : 0
  project             = var.gcp_project
  name                = local.name
  region              = var.cloud_region
  database_version    = "POSTGRES_${var.managed_postgres.version}"
  deletion_protection = var.environment == "production"
  depends_on          = [google_service_networking_connection.sql]
  settings {
    tier              = local.db_tiers[var.managed_postgres.instance_size]
    availability_type = var.managed_postgres.high_available ? "REGIONAL" : "ZONAL"
    user_labels       = local.labels
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.cell.id
    }
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = var.managed_postgres.backup_days
      }
    }
    insights_config {
      query_insights_enabled = true
    }
  }
}

resource "google_storage_bucket" "media" {
  count                       = var.object_storage.enabled ? 1 : 0
  project                     = var.gcp_project
  name                        = "${local.name}-media"
  location                    = var.cloud_region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = local.labels
  versioning {
    enabled = var.object_storage.versioning
  }
}
