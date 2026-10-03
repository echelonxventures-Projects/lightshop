# Deployment (any cloud, any region)

Everything is configuration. Pick a cloud per **cell** (a region or data centre), create it with Terraform, and point ArgoCD or the deploy workflow at it. No application code knows which cloud or region it runs in.

```
Terraform (infra/terraform)         →  cluster + network + (optional) managed Postgres + bucket
ArgoCD platform-deps (infra/argocd)  →  cert-manager, External Secrets, CNPG*, Strimzi*, Temporal*, Keycloak*, OTel Collector
ArgoCD platform-manifests (infra/k8s/platform) → Postgres cluster + DBs*, Kafka + topics*, ClusterIssuer, ExternalSecrets
LightShop chart (infra/helm/lightshop)          → gateway, catalog, tenant-registry (+worker), web-storefront
                                       * only where the cell runs it in-cluster (else a managed service)
```

## 1. Create a cell

See [infra/terraform/README.md](../../infra/terraform/README.md). Output `argocd_cluster_labels` lists the labels for step 3.

## 2. Images

CI builds all images on every PR, smoke-tests them together as a running stack (read-only root filesystems), and pushes `<registry>/<image>:<12-char sha>` on `main`.

- Default registry: `ghcr.io/<owner>/lightshop`.
- Any other registry (ECR, GAR, ACR, Harbor, Quay): set repo variable `IMAGE_REGISTRY` and secret `IMAGE_REGISTRY_TOKEN` (+ variable `IMAGE_REGISTRY_USER`).
- Images: `catalog`, `gateway`, `tenant-registry` (also runs the Temporal worker with `node dist/worker.js`), `web-storefront`.

## 3. Platform dependencies (ArgoCD)

1. Install ArgoCD in a management cluster, then apply `infra/argocd/platform-deps.yaml` and `infra/argocd/lightshop-cells.yaml`.
2. Register each cell cluster with the labels from Terraform, e.g.:
   ```bash
   argocd cluster add <context> --name staging-us \
     --label lightshop/cell=true --label lightshop/region=us --label lightshop/environment=staging \
     --label lightshop/platform-manifests=true --label lightshop/dep-strimzi=in-cluster ... \
     --annotation lightshop/image-tag=<sha>
   ```
3. Edit `infra/argocd/values/*.yaml` once per organization (OTel exporter backend, Keycloak hostname) and `infra/k8s/platform/*.yaml` (ACME email, SecretStore backend).

Using managed services instead (RDS, Cloud SQL, MSK, Confluent, Temporal Cloud, Auth0…): leave out that `dep-*` label and point the env values (`KAFKA_BROKERS`, `TEMPORAL_ADDRESS`, `OIDC_ISSUER`, DB URL secrets) at the managed endpoint.

## 4. Secrets (per cell, namespace `lightshop`)

| Secret | Keys | Content |
|---|---|---|
| `lightshop-shared` | `gateway-shared-secret` | ≥ 32 random chars; the same value in every workload of the cell |
| `lightshop-catalog-db` | `url` | `postgres://catalog:...@<host>:5432/catalog?sslmode=require` |
| `lightshop-tenant-registry-db` | `url` | `postgres://tenant_registry:...@<host>:5432/tenant_registry?sslmode=require` |
| `lightshop-storefront-oidc` | `client-secret`, `session-secret` | IdP client secret for `lightshop-storefront`; ≥ 32 random chars |
| `temporal-db`, `keycloak-db` | `password` | Only when Temporal/Keycloak run in-cluster |

`infra/k8s/platform/secrets.yaml` creates these through External Secrets from Vault/OpenBao, AWS Secrets Manager, Google Secret Manager or Azure Key Vault (pick one `SecretStore`). `kubectl create secret` works too.

## 5. Cell values

Copy `infra/helm/lightshop/values/cells/example.yaml` to `values/cells/<cell>.yaml`. Set the cell code, OIDC issuer, ingress class and hosts (the API host plus every live store domain served by the cell), and workload-identity annotations if needed.

## 6. Deploy

- **GitOps:** ArgoCD's `lightshop-cells` ApplicationSet syncs automatically. To release, bump the cluster annotation `lightshop/image-tag` (or use ArgoCD Image Updater).
- **Push:** *Actions → Deploy → Run workflow* (environment, cell, image tag). It needs the environment secret `KUBECONFIG_<CELL>` (base64 kubeconfig, upper-case cell). It runs an atomic `helm upgrade` (automatic rollback on failure) and then in-cluster health checks.

## 7. Launch the first store (zero code)

```bash
ADMIN_TOKEN=...   # platform:admin token from your IdP
curl -X PUT  https://<registry>/v1/tenants/acme -H "authorization: Bearer $ADMIN_TOKEN" -d @acme.json
curl -X POST https://<registry>/v1/tenants/acme/launch -H "authorization: Bearer $ADMIN_TOKEN"
```

Add the TXT record the launch asks for (`_lightshop-challenge.<domain>`). The workflow verifies it and publishes the store. Add the domain to the cell's ingress hosts (or automate with external-dns / Gateway API).

## Verification checklist

- [ ] `kubectl -n lightshop get pods`: all Ready; `deploy` workflow smoke check green
- [ ] Gateway `/health` and storefront `/api/health` return 200 through the ingress
- [ ] Grafana / your OTLP backend shows `service.name` = gateway, catalog, tenant-registry, with the `lightshop.region` attribute
- [ ] `lightshop_outbox_pending` near 0; Kafka topics `catalog.product.v1`, `tenancy.tenant.v1` receiving
- [ ] Sign-in works on a store domain; a token from another store is rejected (403)
- [ ] Services refuse to boot with unsafe production config (look for "Unsafe production configuration" if a pod crashes)

## Rollback

- Push deploys are `--atomic`: a failed rollout reverts automatically. Manual: `helm rollback lightshop <revision> -n lightshop`.
- GitOps: set `lightshop/image-tag` back to the previous SHA.
- Database migrations are additive (`CREATE … IF NOT EXISTS`), so the previous image runs against the newer schema.
