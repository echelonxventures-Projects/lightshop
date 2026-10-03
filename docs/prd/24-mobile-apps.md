# PRD: Client Applications

**Phase:** 1–3 · **Owning team:** Web & mobile squads

## Purpose

Fast, accessible, white-label clients for every persona.

## MVP scope

- Web storefront (Next.js) ✅ skeleton: tenant by Host, theme tokens, home/category/product pages
- Customer mobile app (Expo) themed from TenantConfig at runtime
- Seller Central (web)
- Admin console (web)

## Later scope

- B2B buyer portal
- Seller mobile app
- Warehouse handheld app
- Rider app (offline-first)
- Store POS + associate app
- Support agent desk
- Advertiser console
- Developer portal

## Key entities

(presentation only; uses federated graph)

## API surface

GraphQL via BFFs; shared `libs/api-sdk` and `libs/ui`

## Events published

- (none)

## Business-model notes

White-label mobile: one binary per tenant (build-time brand) or one multi-tenant app (runtime theme), chosen per tenant.

## Non-functional requirements and acceptance

- Core Web Vitals green on mid-tier Android
- WCAG 2.2 AA
- RTL and 30+ locales supported by design system

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
