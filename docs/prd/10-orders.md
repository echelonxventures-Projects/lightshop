# PRD: Orders (OMS) & Distributed Order Management

**Phase:** 1 · **Owning team:** Fulfillment squad

## Purpose

Own the order lifecycle from placement to closure, sourcing each line from the best node.

## MVP scope

- Order aggregate with shipments per seller/node
- Temporal workflow: placed → paid → allocated → packed → shipped → delivered → closed
- Cancellations (full/partial), modifications before pack
- Customer order history and tracking

## Later scope

- DOM sourcing: nearest FC, store, dark store or seller by cost/SLA
- Pre-orders, backorders, subscriptions
- Split/merge shipments

## Key entities

`Order`, `OrderLine`, `Shipment`, `Allocation`

## API surface

`order`, `orders`, `cancelOrder`; workflow signals

## Events published

- `orders.order.v1 (placed, paid, allocated, shipped, delivered, cancelled, closed)`

## Business-model notes

B2B: PO references, partial deliveries, invoice-on-ship. Grocery: substitutions. Marketplace: seller acceptance SLA.

## Non-functional requirements and acceptance

- No order lost or duplicated across failures
- State transitions visible to customers < 5 s

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
