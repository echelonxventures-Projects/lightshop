# LightShop

A **white-label, vendor-neutral unified commerce platform**. One codebase runs B2C marketplaces (Amazon/Flipkart-style), B2B wholesale (Alibaba-style), first-party omnichannel retail (Walmart-style) and D2C brand stores, in any combination, for any industry and region.

- **White-label:** every store's brand, domains, theme, languages and currencies come from config. No store name is hard-coded.
- **Zero-code store launch:** a store is one validated `TenantConfig` ([guide](docs/guides/launch-a-store.md)).
- **Zero vendor lock-in:** every external service sits behind a port with an open-source default ([ADR-0006](docs/adr/0006-zero-vendor-lock-in.md)).
- **Any industry:** verticals are data ([Vertical Packs](docs/adr/0007-vertical-packs.md)).

## Quick start (no Docker needed)

```bash
pnpm install
pnpm build
pnpm dev:catalog    # :4001, in-memory storage, demo data
pnpm dev:web        # :5678
```

Then open two differently branded stores served by the **same** process:

- http://acme.localhost:5678: *Acme Mart*, a B2C marketplace with a multi-seller buy box (USD)
- http://verde.localhost:5678: *Verde Wholesale*, B2B with MOQ, RFQ and INR, localized to Hindi with `hi-IN`

To use real Postgres and Kafka: `cp .env.example .env && pnpm infra:up`. See the [local development runbook](docs/runbooks/local-development.md).

## Repository layout

```
apps/web-storefront     Next.js white-label storefront (built)    · other apps planned (see READMEs)
services/catalog        Catalog subgraph: reference service (built)
services/tenant-registry  Store configs: versioned edits, launch workflow (Temporal), live distribution (built)
services/gateway        Public GraphQL edge: tenant by Host, auth, rate limits, CORS, federation (built)
libs/domain-kernel      Money, Currency, Address, TenantContext, i18n
libs/tenancy            TenantConfig schema, host resolution, theme → CSS variables
libs/adapters           Ports + open-source default adapters (events, payments, tax, search, storage)
libs/vertical-packs     Industry packs (general, electronics, fashion, grocery, industrial, pharmacy)
libs/contracts          GraphQL subgraph SDL + domain event contracts
libs/ui                 Token-driven design system + Storybook
libs/auth               OIDC/JWKS token verification, roles, dev tokens, gateway trust
libs/observability      OpenTelemetry bootstrap (OTLP, any backend) + trace-correlated JSON logs
libs/testing            Fixtures, dev tokens, throwaway Postgres DBs, integration-test gating
libs/outbox             Transactional outbox stores + relay shared by all services
libs/api-sdk            Typed client for the public API (web, mobile, partners, BFFs)
libs/graphql-security   Query depth/token limits shared by gateway and subgraphs
config/tenants          One JSON file per store
infra/                  Helm chart, ArgoCD ApplicationSet, cloud-neutral Terraform, local compose init
docs/                   Architecture, ADRs, 24 PRDs, roadmap & estimates, guides, runbooks
```

## Commands

| Command | What it does |
|---|---|
| `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck` | Run across all projects (Nx, cached) |
| `pnpm affected` | Lint/test/build only what changed |
| `pnpm --filter @lightshop/web-storefront e2e` | Playwright: two tenants, one deployment |
| `pnpm --filter @lightshop/ui storybook` | Design system on :6006 |
| `pnpm infra:up` / `pnpm infra:up:full` | Local Postgres + Kafka / + Valkey, OpenSearch, Temporal, Keycloak, S3 storage, observability |
| `pnpm infra:up:obs` | OTel Collector + Tempo + Prometheus + Grafana (:3001) |

## Documentation

Start at [docs/README.md](docs/README.md): [architecture overview](docs/architecture/overview.md), [context map](docs/architecture/context-map.md), [ADRs](docs/adr/README.md), [PRDs](docs/prd/README.md), [roadmap & estimation](docs/roadmap.md).
