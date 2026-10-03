# PRD: Catalog & PIM

**Phase:** 0 (reference service built) · **Owning team:** Catalog squad

## Purpose

Vertical-agnostic product information: products, variants, seller offers and buy box. Industry rules come from vertical packs.

## MVP scope

- Product → Variant → Offer model; many sellers per product
- Attribute validation against vertical pack JSON Schema ✅
- Buy box: lowest in-stock NEW price, falling back to other conditions ✅
- Localized titles with fallback chain ✅
- Tenant-scoped storage + transactional outbox ✅
- Bulk import (CSV/XLSX/API) with per-row validation reports
- Media management via ObjectStorage port

## Later scope

- Product matching and dedup (ML)
- AI listing generation from images (LLM, via adapter)
- Bundles, kits, configurable and made-to-order products
- Digital goods, bookings, rentals, subscriptions
- Global catalog syndication to regional cells
- Brand registry integration

## Key entities

`Product`, `Variant`, `Offer`, `VerticalPack`, `Category`, `MediaAsset`

## API surface

Subgraph `libs/contracts/schema/catalog.graphql`: `product`, `products`, `verticalPacks`, `createProduct`, `addOffer`

## Events published

- `catalog.product.v1 (created ✅, offer-added ✅, updated, archived)`

## Business-model notes

B2C: multi-seller offers + buy box. B2B: MOQ floors from pack attributes ✅, tiered prices via pricing. 1P: platform-owned seller ID. D2C: single offer.

## Non-functional requirements and acceptance

- Product page query p95 < 50 ms in-cell
- Import 1M SKUs/hour per cell
- Zero cross-tenant reads (enforced by repository port)

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
