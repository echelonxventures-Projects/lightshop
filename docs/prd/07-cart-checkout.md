# PRD: Cart & Checkout

**Phase:** 1 · **Owning team:** Checkout squad

## Purpose

Turn intent into a paid order in ≤ 3 steps, for consumers and businesses, across sellers, fulfillment nodes and regions.

## MVP scope

- Persistent cart (guest → user merge), save for later, wishlists
- Multi-seller cart split into shipments
- Address validation and geocoding (adapter)
- Delivery options: standard, express, scheduled slot, store pickup
- Tax via TaxProvider port (table default) ✅ adapter built
- Idempotent order placement

## Later scope

- One-click/express checkout
- B2B: PO number, cost center, approval routing, quick order by SKU/CSV, reorder
- Cross-border duties (DDP/DAP)
- Shared carts and lists

## Key entities

`Cart`, `CartLine`, `CheckoutSession`, `DeliveryOption`, `Address`

## API surface

`cart`, `addToCart`, `startCheckout`, `selectDelivery`, `placeOrder`

## Events published

- `checkout.session.v1 (started, completed, abandoned)`

## Business-model notes

B2B: approval workflow before order. 1P/grocery: slots, substitutions preference. Marketplace: per-seller shipping.

## Non-functional requirements and acceptance

- Checkout availability 99.99%
- placeOrder p95 < 800 ms incl. payment authorization
- No double orders on retries (idempotency keys)

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
