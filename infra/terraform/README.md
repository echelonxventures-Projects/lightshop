# Terraform: regional cells on any cloud

```
contract/            The cell interface: variables.tf + outputs.md (cloud-neutral)
providers/aws        VPC + EKS (IRSA) + RDS Postgres (Multi-AZ, Secrets Manager password) + S3
providers/gcp        VPC-native private GKE (Workload Identity) + private Cloud SQL (regional HA, PITR) + GCS
providers/azure      VNet + AKS (OIDC/workload identity, zones) + Postgres Flexible (private, Entra auth, ZRS HA) + Blob
providers/on-prem    Any existing Kubernetes (k3s/RKE2/OpenShift/Talos/kubeadm); everything runs in-cluster
envs/<cloud>         Root module per cloud. ONE STATE PER CELL, selected with a tfvars file
scripts/check-contract.py   CI check that every provider and env matches the contract exactly
```

- **Regions are configuration.** A cell is a tfvars file (`cell`, `cloud_region`, sizes). Add a region by adding a file; nothing in code names a region.
- **Sizes are provider-neutral** (`small | medium | large | xlarge`), and each provider maps them to its instance types.
- **Managed or in-cluster:** `managed_postgres.enabled = false` runs CloudNativePG instead. The `argocd_cluster_labels` output tells ArgoCD which dependencies to install in that cell.
- **Mixed clouds:** cells can live on different clouds at once (e.g. US on AWS, India on-prem). The app layer is identical.

```bash
cd infra/terraform/envs/aws
cp cells/example.tfvars cells/staging-us.tfvars          # edit
terraform init -backend-config=...                       # remote state, one key per cell
terraform plan  -var-file=cells/staging-us.tfvars
terraform apply -var-file=cells/staging-us.tfvars
terraform output -json cell                              # kubeconfig command, endpoints, ArgoCD labels
```

Validated in CI on every PR (`fmt`, contract check, `init -backend=false` + `validate` for all four clouds).
