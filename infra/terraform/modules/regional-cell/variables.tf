variable "region_code" {
  description = "LightShop region code (us, eu, in, sea, ...). Drives data residency labels."
  type        = string
}

variable "cloud_region" {
  description = "Provider-specific region/location (e.g. us-east-1, europe-west3, centralindia)."
  type        = string
}

variable "environment" {
  type = string
}

variable "kubernetes_version" {
  type    = string
  default = "1.33"
}

variable "node_pools" {
  description = "Node pools by workload class."
  type = map(object({
    min_nodes     = number
    max_nodes     = number
    instance_size = string # provider-neutral size class: small | medium | large | xlarge
  }))
  default = {
    general = { min_nodes = 3, max_nodes = 30, instance_size = "large" }
    stateful = { min_nodes = 3, max_nodes = 9, instance_size = "xlarge" }
  }
}

variable "postgres" {
  type = object({
    version         = string
    size            = string
    high_available  = bool
    backup_days     = number
  })
  default = { version = "17", size = "large", high_available = true, backup_days = 35 }
}
