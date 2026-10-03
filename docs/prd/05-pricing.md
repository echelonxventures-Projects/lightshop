# PRD: Pricing

**Phase:** 1 · **Owning team:** Pricing squad

## Purpose

Every price a buyer sees: list, sale, tiered, contract, regional and FX-converted, with an auditable trail.

## MVP scope

- Price lists per tenant/region/channel/segment
- B2B tiered (volume) and contract pricing per buyer org
- FX conversion with rate locking at checkout
- Tax-inclusive vs exclusive display per region
- Price history (for compliance and 'lowest in 30 days' rules)

## Later scope

- Dynamic pricing engine (demand, competition, inventory)
- Live commodity-linked pricing (gold, metals)
- Price-match rules

## Key entities

`PriceList`, `PriceRule`, `Tier`, `ContractPrice`, `FxSnapshot`

## API surface

`priceFor(products, buyerContext)`, admin price list CRUD

## Events published

- `pricing.price.v1 (changed)`

## Business-model notes

B2C: sale prices and strike-through. B2B: tiers, contracts, quotes override. 1P: store-specific pricing.

## Non-functional requirements and acceptance

- Price resolution p95 < 20 ms for 50 SKUs
- Every displayed price traceable to a rule + version

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
