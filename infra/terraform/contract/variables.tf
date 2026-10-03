# ---------------------------------------------------------------------------------------------
# Regional cell CONTRACT. Every providers/<cloud> module declares exactly these variables (it may
# add provider-specific optional ones prefixed with the provider name) and these outputs.
# CI (scripts/check-contract.py) fails if an implementation drifts.
# ---------------------------------------------------------------------------------------------

variable "cell" {
  description = "Cell code (us, eu, in, sea, anything). Becomes the data-residency label and the ArgoCD region label."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.cell))
    error_message = "cell must be a short lowercase code, e.g. us, eu-west, in."
  }
}

variable "cloud_region" {
  description = "Provider location for this cell (us-east-1, europe-west3, centralindia, dc-mumbai-1, ...)."
  type        = string
}

variable "environment" {
  description = "staging | production | any environment name."
  type        = string
}

variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
  default     = "lightshop"
}

variable "kubernetes_version" {
  description = "Kubernetes minor version for the cell cluster."
  type        = string
  default     = "1.33"
}

variable "node_pools" {
  description = "Node pools by workload class. instance_size is provider-neutral: small | medium | large | xlarge."
  type = map(object({
    min_nodes     = number
    max_nodes     = number
    instance_size = string
  }))
  default = {
    general  = { min_nodes = 3, max_nodes = 30, instance_size = "large" }
    stateful = { min_nodes = 3, max_nodes = 9, instance_size = "xlarge" }
  }
}

variable "managed_postgres" {
  description = "Create a managed Postgres for the cell. Disabled = run CloudNativePG in-cluster (infra/k8s/platform/postgres.yaml)."
  type = object({
    enabled        = bool
    version        = string
    instance_size  = string
    high_available = bool
    backup_days    = number
  })
  default = { enabled = true, version = "17", instance_size = "large", high_available = true, backup_days = 35 }
}

variable "object_storage" {
  description = "Create a bucket for media/backups."
  type = object({
    enabled    = bool
    versioning = bool
  })
  default = { enabled = true, versioning = true }
}

variable "tags" {
  description = "Extra tags/labels for every resource."
  type        = map(string)
  default     = {}
}
