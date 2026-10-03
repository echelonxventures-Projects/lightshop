# PRD: Advertising (Retail Media)

**Phase:** 3 · **Owning team:** Ads squad

## Purpose

Retail media network monetizing on-site and off-site traffic for sellers and brands.

## MVP scope

- Sponsored products (CPC) in search and PDP
- Campaign, ad group, keyword and bid management
- Budget pacing
- Attribution to orders

## Later scope

- Sponsored brands and display
- Off-site ads
- Brand stores
- Self-serve API for agencies

## Key entities

`Campaign`, `AdGroup`, `Bid`, `Impression`, `Click`, `Attribution`

## API surface

Ads subgraph + auction service (low-latency internal API)

## Events published

- `ads.impression.v1`
- `ads.click.v1`

## Business-model notes

Available on marketplace tenants; D2C tenants can disable.

## Non-functional requirements and acceptance

- Auction p99 < 20 ms
- Clear labelling of sponsored results per regulation

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
