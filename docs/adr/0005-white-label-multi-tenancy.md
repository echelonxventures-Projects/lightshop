# ADR-0005: White-label multi-tenancy via TenantConfig (zero-code store launch)

**Status:** Accepted · 2026-10-03

## Context
The client will run its own marketplaces and also license the platform to brands and operators. New stores must launch without engineering work, and no tenant may see another tenant's data or branding.

## Decision
- A **TenantConfig** (`libs/tenancy`, validated with zod) fully defines a store: brand, theme tokens, domains, regions, locales, currencies, business models, enabled vertical packs, adapter selection and feature flags.
- Today configs are JSON files in `config/tenants/`. In Phase 1 the `tenant-registry` service stores them and the admin console edits them. Services subscribe to `tenancy.tenant.v1` and hot-reload.
- The **tenant is resolved at the edge** by Host header (custom domains) or `x-tenant-id` (trusted, set by the gateway). Region, locale and currency are clamped to the values the tenant enabled.
- The **UI is token-driven**: components read only `--ls-*` CSS variables, and `themeToCss()` renders a tenant's tokens (sanitized) per request. A test asserts the design system contains no platform branding.
- **Data isolation:** every table has `tenant_id` in its primary key, and repository ports only expose tenant-scoped methods. Phase 1 adds Postgres RLS. Large tenants can get dedicated databases (silo mode) through the same repository adapters.

## Consequences
- Launching a store = add a config, point DNS, done. This is demonstrated by `acme-mart` and `verde-wholesale` running on one deployment (Playwright test).
- Tenant-specific behaviour **must** be expressed as config, flags, packs or adapters. Code `if (tenant === 'x')` is forbidden in review.
- Custom domains need automated TLS (cert-manager/ACME) at the edge.
