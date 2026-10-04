# Production-like local stack

Run the **whole platform on one machine with the production artifacts and configuration** before deploying anywhere:
the same container images, `NODE_ENV=production` (every fail-fast check active), a real identity provider,
Temporal with its worker, Kafka, Postgres, telemetry, and an ingress. Only the infrastructure underneath
differs (Docker instead of a cloud), which is exactly what the agnostic design allows.

```
browser ──► edge (Caddy, :8088) ──► web-storefront ──► gateway ──► catalog ──► Postgres
             /graphql ───────────────────────────────► gateway        │          Kafka (outbox events)
                                                                      ▼
             tenant-registry (+ Temporal worker) ◄── live tenant configs (ETag polling)
             Keycloak (OIDC, realm as code) · OTel Collector → Tempo + Prometheus → Grafana
```

## Commands

| Command | What it does |
|---|---|
| `pnpm local:up` | Builds the images, starts everything, waits for health, then seeds demo data **through the public API with real Keycloak tokens** |
| `pnpm local:test` | End-to-end suite against the running stack (`apps/web-storefront/e2e-stack`) |
| `pnpm local:status` / `pnpm local:logs [service]` | Health and logs |
| `pnpm local:down` / `pnpm local:reset` | Stop / stop and delete all data |

Requirements: Docker (Desktop, Colima, Rancher Desktop, OrbStack or Linux Docker) with **≥ 6 GB memory** for the VM, plus Node 22 and pnpm.

## What you can do

| URL | |
|---|---|
| http://acme.localhost:8088 | Acme Mart: B2C marketplace, multi-seller buy box, USD |
| http://verde.localhost:8088 | Verde Wholesale: B2B, MOQ/RFQ, INR, Hindi with `hi-IN` |
| http://localhost:8180 | Keycloak (admin / admin). Shoppers: `ana`/`ana` (Acme), `raj`/`raj` (Verde) |
| http://localhost:8233 | Temporal UI: watch `tenant-launch-*` workflows |
| http://localhost:3001 | Grafana → LightShop → Service overview |
| http://localhost:4002 | Tenant registry admin API (local only; internal in production) |

Launch a new store with zero code:

```bash
OPS=$(curl -s localhost:8180/realms/lightshop/protocol/openid-connect/token \
  -d grant_type=password -d client_id=lightshop-ci -d client_secret=ci-secret -d username=ops -d password=ops | jq -r .access_token)
curl -X PUT localhost:4002/v1/tenants/bloom -H "authorization: Bearer $OPS" -H 'content-type: application/json' \
  -d '{"brand":{"name":"Bloom Beauty"},"theme":{"colorPrimary":"#B0306A"},"domains":["bloom.localhost"],"regions":["eu"],"locales":["en-GB"],"currencies":["EUR"],"businessModels":["d2c"],"verticals":["general"]}'
curl -X POST localhost:4002/v1/tenants/bloom/launch -H "authorization: Bearer $OPS"
open http://bloom.localhost:8088      # live within seconds, no restart
```

## Production parity

| Concern | Local stack | Production |
|---|---|---|
| Images | Built from the same Dockerfiles | Same images, from CI |
| Config | `NODE_ENV=production`, OIDC, gateway secret, Postgres, Temporal (unsafe config refuses to boot) | Same variables from Helm values + secrets |
| Ingress | Caddy: store domains → storefront, `/graphql` → gateway | Any ingress controller, same routing (`infra/helm/lightshop`) |
| Identity | Keycloak in production mode on Postgres, realm as code | Any OIDC provider with the same claims contract |
| Data | Demo data loaded through the API (no `SEED_DEMO`) | Real tenants via the registry |
| Filesystem | Read-only root, tmpfs scratch | Read-only root, emptyDir scratch |

All host ports are configurable (`LS_HTTP_PORT`, `LS_KEYCLOAK_PORT`, `LS_PG_PORT`, `LS_KAFKA_PORT`, `LS_GRAFANA_PORT`, …; see `.env.example`). If you change `LS_HTTP_PORT` or `LS_KEYCLOAK_PORT`, also update the storefront redirect URIs in `infra/keycloak/lightshop-realm.json`.

## Next: production

When the local suite passes, the same commit's images (built and smoke-tested by CI) go to production with
[the deployment runbook](deployment.md).
