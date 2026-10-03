# PRD: Inventory & Warehouse (WMS)

**Phase:** 1–2 · **Owning team:** Supply chain squad

## Purpose

Accurate available-to-promise across every node, and warehouse execution for platform-fulfilled goods.

## MVP scope

- Stock per SKU per node (FC, store, dark store, seller, 3PL)
- Reservations with TTL at checkout; commit on payment
- ATP and safety stock
- Seller inventory sync via API/CSV

## Later scope

- WMS: inbound/ASN, putaway, pick-pack waves, cycle counts, barcode/RFID handheld app
- Batch/expiry (grocery, pharmacy) and serial tracking (electronics) from pack capabilities
- Demand forecasting + auto-replenishment POs (1P)
- Fulfilled-by-platform program

## Key entities

`StockItem`, `Node`, `Reservation`, `Asn`, `PickWave`

## API surface

`availability(skus, location)`, `reserve`, `commit`, `release`

## Events published

- `inventory.stock.v1 (changed, low)`

## Business-model notes

1P/omnichannel: store inventory visibility, ship-from-store. Marketplace: seller-fulfilled vs platform-fulfilled.

## Non-functional requirements and acceptance

- Zero oversell during flash sales (inventory tokens)
- Availability read p95 < 15 ms

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
