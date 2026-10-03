variable "gcp_project" {
  description = "GCP project id for this cell."
  type        = string
}

variable "gcp_subnet_cidr" {
  type    = string
  default = "10.40.0.0/20"
}
