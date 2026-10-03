cell                       = "dc1"
cloud_region               = "mumbai-dc-1"
environment                = "staging"
on_prem_cluster_endpoint   = "https://k8s.dc1.internal:6443"
on_prem_kubeconfig_context = "dc1-staging"
on_prem_s3_endpoint        = "https://s3.dc1.internal"
managed_postgres           = { enabled = false, version = "17", instance_size = "large", high_available = true, backup_days = 35 }
