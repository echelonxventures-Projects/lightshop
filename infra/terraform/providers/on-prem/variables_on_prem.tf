variable "on_prem_cluster_endpoint" {
  description = "API server URL of the existing cluster (k3s, RKE2, OpenShift, Talos, kubeadm, any CNCF-conformant Kubernetes)."
  type        = string
}

variable "on_prem_kubeconfig_context" {
  description = "kubeconfig context name for the cluster."
  type        = string
}

variable "on_prem_s3_endpoint" {
  description = "S3-compatible endpoint (Ceph RGW, SeaweedFS, Garage, MinIO...). Empty = none."
  type        = string
  default     = ""
}
