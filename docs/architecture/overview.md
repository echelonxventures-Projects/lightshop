# Architecture Overview

LightShop is a **white-label, vendor-neutral unified commerce platform**. One codebase and one deployment per region serve any number of branded stores, each running any combination of business models:

| Model | Reference | What it adds on the shared core |
|---|---|---|
| B2C multi-vendor marketplace | Amazon, Flipkart | Many sellers per product, buy box, seller central, commissions and payouts |
| B2B wholesale | Alibaba | RFQ, MOQ, tiered/contract pricing, buyer orgs and approvals, net terms, trade assurance |
| First-party retail + omnichannel | Walmart | Own inventory, stores, POS, BOPIS, ship-from-store, grocery slots, quick commerce |
| D2C / single brand | Shopify-style | One seller, own domain, brand storefront |

## Principles

1. **One commerce core, many business models.** Seller type, buyer type and channel are configuration, never forks of the code.
2. **White-label from day 1.** Brand, domains, theme tokens, locales, currencies, legal text and templates live in `TenantConfig`. No store name is hard-coded anywhere (enforced by a unit test in `libs/ui`).
3. **Zero-code store launch.** A valid `TenantConfig` is the whole definition of a store. See [launch a store](../guides/launch-a-store.md).
4. **Zero vendor lock-in.** Every external dependency is a port in `libs/adapters` with an open-source default. Lint rules forbid vendor SDK imports outside adapters. See [ADR-0006](../adr/0006-zero-vendor-lock-in.md).
5. **Vertical-agnostic catalog.** Industries are [Vertical Packs](../adr/0007-vertical-packs.md): data, not code.
6. **Domain-driven services** that communicate through events (transactional outbox → Kafka protocol); synchronous calls happen only at the GraphQL edge.
7. **Cell-based multi-region** with data residency. See [ADR-0002](../adr/0002-cell-based-multi-region.md).
8. **API-first and headless.** Everything the first-party apps can do, a partner can do through the public GraphQL API.

## System diagram

```
 Clients: Web storefront · iOS/Android · Seller Central · B2B portal · Admin · POS · Rider/Warehouse apps · Partner APIs
        │
   CDN / Edge  (WAF, bot management, edge cache, geo-routing by tenant home region)
        │
   API Gateway  →  GraphQL Federation Gateway  →  BFFs (web / mobile / partner)
        │                       (tenant resolved from Host or x-tenant-id)
 ┌──────────────────────── Regional cell (us / eu / in / sea …) ────────────────────────┐
 │  Domain services (NestJS subgraphs) ── Kafka-protocol event bus ── Temporal workflows  │
 │  Postgres per service · Valkey/Redis · OpenSearch · S3-compatible object storage       │
 └────────────────────────────────────────────────────────────────────────────────────────┘
        │
 Global control plane: identity · tenant registry · catalog syndication · FX rates · feature flags
        │
 Data platform: CDC → lakehouse → feature store → recs / ranking / fraud / forecasting models
```

## Tenancy model

```
Tenant (white-label operator or brand; owns domains, theme, adapters, enabled verticals)
  └── Organization (a seller company, or a B2B buyer company with roles and approval rules)
        └── User (customer, seller staff, buyer, approver, store associate, admin)
```

Every row a service stores is keyed by `tenant_id`, plus `region` for residency. Repository ports only offer tenant-scoped reads (see `services/catalog/src/infrastructure/product-repository.ts`). Postgres row-level security is added as defence in depth in Phase 1.

## Request flow (implemented in Phase 0)

1. The browser hits `verde.localhost`. The storefront resolves `TenantConfig` by Host (`apps/web-storefront/lib/tenant.ts`) and injects theme tokens as CSS variables (`libs/tenancy/src/theme-css.ts`).
2. The storefront calls the catalog subgraph with `x-tenant-id` and `accept-language`.
3. The catalog builds a `RequestContext` and clamps region, locale and currency to what the tenant enabled (`services/catalog/src/graphql/context.ts`).
4. Writes validate against the vertical pack, then persist the aggregate and its domain events in **one transaction** (outbox).
5. `OutboxRelay` publishes the events to the bus. Search, pricing, analytics and other contexts consume them.

## Technology choices

| Layer | Choice | Swappable because |
|---|---|---|
| Language | TypeScript everywhere (Python only for ML) | — |
| Monorepo | Nx + pnpm workspaces | — |
| Web | Next.js (App Router, RSC) | Headless API |
| Mobile | React Native (Expo) | Headless API |
| Services | NestJS + Apollo Federation v2 subgraphs | Federation is an open spec |
| DB | PostgreSQL per service | Plain SQL, any managed Postgres |
| Events | Kafka protocol (Apache Kafka, Redpanda, MSK, Confluent…) | `EventBus` port |
| Workflows | Temporal (MIT, self-hostable) | Saga logic in activities |
| Search | Postgres FTS → OpenSearch | `SearchProvider` port |
| Cache | Valkey (BSD) | Redis protocol |
| Storage | S3 API (SeaweedFS, Garage, Ceph, R2, S3) | `ObjectStorage` port |
| Auth | OIDC (Keycloak default) | Standard protocol |
| Infra | Kubernetes + Helm + ArgoCD, Terraform per cloud | No cloud-only services in the core path |
| Observability | OpenTelemetry → Grafana stack | OTLP is vendor-neutral |

## Non-functional targets

| Metric | Target |
|---|---|
| Availability | 99.95% platform, 99.99% checkout |
| API latency | p95 < 200 ms at the edge, p99 < 500 ms |
| Flash sale | 1M+ concurrent sessions (waiting room, pre-warmed caches, inventory tokens) |
| Web vitals | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on a mid-tier Android phone over 4G |
| DR | RPO ≤ 5 min, RTO ≤ 30 min per region |
| Accessibility | WCAG 2.2 AA |

## Security and compliance

PCI-DSS (tokenization keeps card data out of scope; payments run in an isolated zone), SOC 2, ISO 27001, GDPR, CCPA, India DPDP, PSD2/SCA and per-country e-invoicing. The platform uses a zero-trust mesh (mTLS), Vault/KMS secrets, field-level PII encryption, immutable audit logs, and SAST/DAST/SCA in CI.

See also: [context map](context-map.md) · [service template](service-template.md) · [roadmap](../roadmap.md)
