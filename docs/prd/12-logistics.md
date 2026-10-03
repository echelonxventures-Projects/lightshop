# PRD: Logistics & Last Mile

**Phase:** 1–2 · **Owning team:** Logistics squad

## Purpose

Ship anything anywhere: carrier aggregation, own fleet, quick commerce and freight.

## MVP scope

- Shipping adapter port (flat-rate default; EasyPost/Shippo/Shiprocket/Delhivery etc. as adapters)
- Rate shopping, labels, tracking webhooks
- Delivery promise (ETA) calculation

## Later scope

- Own last-mile: rider app, dispatch, route optimization, proof of delivery (photo/OTP/signature)
- Quick commerce 10–30 min from dark stores
- Bulky/installation services
- Cross-border: customs docs, HS codes, consolidation
- B2B freight quotes (LTL/FTL/LCL/FCL)

## Key entities

`Shipment`, `Carrier`, `Label`, `Route`, `Rider`, `ProofOfDelivery`

## API surface

`rates`, `createShipment`, `track`

## Events published

- `logistics.shipment.v1 (label-created, picked-up, in-transit, delivered, exception)`

## Business-model notes

Grocery: slots and cold chain. B2B: freight. Marketplace: seller-shipped with platform labels.

## Non-functional requirements and acceptance

- Tracking event ingestion lag < 60 s
- Delivery promise accuracy > 95%

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
