# tenant-registry

System of record for white-label `TenantConfig` ([PRD](../../docs/prd/02-tenant-registry.md)). Built from the [service template](../../docs/architecture/service-template.md).

| Endpoint | Who | Purpose |
|---|---|---|
| `GET /v1/tenants?status=live` | services/gateway (gateway secret) or `platform:admin` | All configs; `ETag` + `If-None-Match` → 304 for cheap polling |
| `GET /v1/tenants/:id` | same | One record `{ config, version, updatedAt, updatedBy }` |
| `PUT /v1/tenants/:id` | `platform:admin`; `tenant:admin` for own store (no domain changes) | Create (as `draft`) or update; `If-Match: "v<n>"` for safe concurrent edits |
| `POST /v1/tenants/:id/launch` | `platform:admin` | Launch workflow: validate → verify domain ownership (DNS TXT) → publish |
| `GET /v1/tenants/:id/launch` | authenticated | Workflow status and progress |
| `POST /v1/tenants/:id/publish` · `/suspend` | `platform:admin` | Lifecycle changes |

Every change is versioned and audited, and publishes `tenancy.tenant.v1` through the transactional outbox. The catalog and storefront use `LiveTenantRegistry` (`TENANTS_URL`), so changes apply within `TENANTS_REFRESH_MS` (default 15 s) without a restart. An invalid config can never replace a good one.

**Domain ownership:** for a real domain, add a TXT record `_lightshop-challenge.<domain>` = `lightshop-verify=<tenantId>`. `*.localhost` and `*.test` are trusted for development.

**Launch execution:** with `TEMPORAL_ADDRESS` set, launches run as the durable `tenantLaunchWorkflow` (DNS checks retry with backoff for ~3 days) on the worker (`pnpm --filter @lightshop/tenant-registry worker`). Without it, launches run inline (development only; production refuses to boot without Temporal).

```bash
pnpm dev:registry   # :4002, imports config/tenants/*.json once
ADMIN=$(pnpm -s dev:token --tenant '*' --roles platform:admin)
curl -X PUT localhost:4002/v1/tenants/bloom -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d @bloom.json
curl -X POST localhost:4002/v1/tenants/bloom/launch -H "authorization: Bearer $ADMIN"
```
