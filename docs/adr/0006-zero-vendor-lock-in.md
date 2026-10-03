# ADR-0006: Zero vendor lock-in — ports and adapters with open-source defaults

**Status:** Accepted · 2026-10-03

## Context
The client must be able to self-host, change clouds and PSPs, and resell the platform without negotiating with any single vendor.

## Decision
- Every external capability is a **port** (TypeScript interface) in `libs/adapters`: `EventBus`, `PaymentProvider`, `TaxProvider`, `SearchProvider`, `ObjectStorage`; notifications, shipping, KYC, maps and auth follow the same pattern.
- **Open-source defaults** ship for each port so the platform runs with no third-party accounts:

  | Port | Default | Examples of drop-in alternatives |
  |---|---|---|
  | Events | Kafka protocol (Apache Kafka) | Redpanda, MSK, Confluent |
  | Payments | `manual` (COD, bank transfer, invoice) | Stripe, Adyen, Razorpay, PayPal, Mollie |
  | Tax | `table` (rate table per jurisdiction) | Avalara, Vertex, TaxJar, Fonoa |
  | Search | Postgres FTS → OpenSearch | Meilisearch, Typesense, Vespa |
  | Storage | S3 API (SeaweedFS locally) | Garage, Ceph, R2, S3, GCS-interop |
  | Auth | OIDC (Keycloak) | Ory, Zitadel, Auth0, Entra ID |
  | Cache | Valkey | Redis, Dragonfly |
  | Observability | OpenTelemetry → Grafana stack | Datadog, Honeycomb, New Relic |

- Tenants select adapters by ID in `TenantConfig.adapters` and `AdapterRegistry` resolves them.
- **Lint-enforced:** `eslint.config.mjs` forbids importing vendor SDKs (`stripe`, `@aws-sdk/*`, …) outside `libs/adapters`.
- Infrastructure is Kubernetes + Helm. Terraform has one module per cloud behind a common variable interface.

## Consequences
- Adding a vendor = one adapter class + registration, with no domain changes.
- Adapters must normalize vendor semantics (statuses, webhooks, idempotency) to the port contract. This is the main cost.
- Managed-service conveniences (DynamoDB, BigQuery-only features) stay out of the core transaction path.
