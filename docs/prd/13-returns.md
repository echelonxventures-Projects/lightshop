# PRD: Returns & Reverse Logistics

**Phase:** 1 · **Owning team:** Fulfillment squad

## Purpose

Fast, policy-driven returns that protect customers and sellers.

## MVP scope

- Return policy from vertical pack + seller overrides
- RMA creation, reason codes, pickup or drop-off
- Refund on pickup/receipt/QC per policy
- Exchanges

## Later scope

- QC grading and refurbish/resale channel
- Instant refunds for trusted customers (risk score)
- Return abuse detection

## Key entities

`ReturnRequest`, `ReturnLine`, `Inspection`, `Refund`

## API surface

`requestReturn`, `returnStatus`

## Events published

- `returns.rma.v1 (requested, approved, received, inspected, refunded, rejected)`

## Business-model notes

Non-returnable verticals (grocery, pharmacy) enforce damage-only claims from pack config.

## Non-functional requirements and acceptance

- Refund initiated within 24 h of qualifying event
- Policy decisions explainable to support agents

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
