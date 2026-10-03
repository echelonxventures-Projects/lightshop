# Terraform

Cloud-neutral by design ([ADR-0006](../../docs/adr/0006-zero-vendor-lock-in.md)):

- `modules/regional-cell`: the **interface** of a cell (inputs/outputs every provider must satisfy).
- `providers/<cloud>`: implementations of that interface: `aws`, `gcp`, `azure`, `on-prem` (bare-metal/k3s). Each creates a Kubernetes cluster, Postgres, object storage endpoint and network, then outputs the same values.
- `envs/<env>-<region>`: compose a provider implementation with environment settings.

Everything above Kubernetes (Kafka via Strimzi, Temporal, OpenSearch, Keycloak, Valkey, observability) is installed by Helm/ArgoCD identically on every cloud. Managed equivalents can be swapped in per region with no app changes.
