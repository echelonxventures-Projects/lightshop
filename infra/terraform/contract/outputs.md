# Cell contract outputs

| Output | Meaning |
|---|---|
| `cell` | Cell code (echo of input) |
| `cluster_name` | Kubernetes cluster name |
| `cluster_endpoint` | API server endpoint |
| `kubeconfig_command` | Command that writes a kubeconfig for the cluster |
| `postgres_endpoint` | `host:port` of the managed Postgres, or `null` when CloudNativePG runs in-cluster |
| `object_storage_endpoint` | S3-API (or provider) endpoint for the bucket, or `null` |
| `object_storage_bucket` | Bucket/container name, or `null` |
| `argocd_cluster_labels` | Labels to put on the ArgoCD cluster secret: cell/region/environment plus `lightshop/dep-*: in-cluster` for every dependency the cell runs itself |
