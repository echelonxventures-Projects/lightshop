# PRD: Seller & Supplier Platform

**Phase:** 1 · **Owning team:** Seller squad

## Purpose

Everything a seller or supplier needs to run a business on any LightShop tenant.

## MVP scope

- Onboarding with KYB, bank details, tax IDs
- Listing management (forms rendered from pack JSON Schema)
- Order and return handling, shipping labels
- Payout statements and fees
- Account health metrics (late shipment, cancellation, defect rates)
- Seller API + webhooks

## Later scope

- Seller storefront pages
- Ads console
- Analytics and benchmarks
- Integrations: Shopify, WooCommerce, ERPs, accounting tools
- Seller mobile app

## Key entities

`Seller`, `SellerUser`, `HealthMetric`, `Storefront`, `ApiKey`, `Webhook`

## API surface

Seller subgraph + REST/webhooks for integrators

## Events published

- `seller.account.v1 (onboarded, suspended, health-changed)`

## Business-model notes

B2B suppliers: RFQ inbox, quotes, sample orders, trade shows. 1P: internal vendor portal for purchase orders.

## Non-functional requirements and acceptance

- Onboarding < 15 minutes for non-regulated verticals
- Listing form generated for any pack without code

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
