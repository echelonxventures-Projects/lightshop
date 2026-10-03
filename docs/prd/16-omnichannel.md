# PRD: Omnichannel Retail & Stores

**Phase:** 2 · **Owning team:** Stores squad

## Purpose

Walmart-class store integration: one inventory, one customer, every channel.

## MVP scope

- Store directory and hours per tenant
- BOPIS and curbside
- Ship-from-store
- Endless aisle (order online from store)
- Web POS (tablet) with offline mode

## Later scope

- Scan & Go
- Store associate app (picking, price checks)
- Electronic shelf label sync
- Pharmacy and services counters as vertical packs

## Key entities

`Store`, `Register`, `StoreOrder`, `PickupSlot`

## API surface

`stores`, `pickupSlots`, POS APIs

## Events published

- `stores.order.v1`

## Business-model notes

1P retail primarily; marketplace tenants can enable pickup points.

## Non-functional requirements and acceptance

- POS keeps selling offline for 24 h and syncs on reconnect
- Store stock accuracy > 98%

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
