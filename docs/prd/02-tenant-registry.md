# PRD: Tenant Registry & Store Launch

**Phase:** 0–1 · **Owning team:** Platform team

## Purpose

System of record for TenantConfig, so a new white-label store launches with zero code: brand, domains, theme, locales, currencies, business models, vertical packs, adapters, flags.

## MVP scope

- CRUD of TenantConfig with schema validation (`libs/tenancy`)
- Draft → live → suspended lifecycle
- Custom domain onboarding: DNS verification + automated TLS (ACME)
- Theme preview before publish
- Publishes `tenancy.tenant.v1`; services hot-reload
- Secrets for adapters stored as references (Vault/KMS), never in config

## Later scope

- Self-serve onboarding wizard (choose models, verticals, PSPs, languages)
- Plans and billing for SaaS mode
- Tenant data export and deletion
- Silo mode (dedicated DB) for enterprise tenants

## Key entities

`TenantConfig`, `Domain`, `ThemeTokens`, `AdapterSelection`, `FeatureFlag`

## API surface

`tenant`, `upsertTenant`, `verifyDomain`, `publishTenant` (admin-only subgraph)

## Events published

- `tenancy.tenant.v1 (created, updated, published, suspended)`

## Business-model notes

Every model is enabled per tenant by `businessModels`; combinations are first-class (e.g. B2C marketplace + 1P retail).

## Non-functional requirements and acceptance

- Store goes live < 10 minutes after config publish (excluding DNS propagation)
- Invalid configs are rejected with field-level errors
- Zero tenant names in code (CI check)

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
