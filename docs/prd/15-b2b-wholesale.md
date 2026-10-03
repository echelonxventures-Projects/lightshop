# PRD: B2B Wholesale

**Phase:** 2 · **Owning team:** B2B squad

## Purpose

Alibaba-class wholesale: discovery, negotiation and procurement between verified businesses.

## MVP scope

- RFQ: buyer posts requirement → suppliers quote → negotiate → convert to order
- MOQ, tiered pricing, sample orders
- Buyer org approvals, budgets, cost centers
- PO-based checkout, net terms, GST/VAT invoices
- Supplier messaging with machine translation

## Later scope

- Trade assurance / escrow
- Inspection services
- Customization/OEM requests
- Punchout (cXML/OCI) to buyer procurement systems
- Virtual trade shows

## Key entities

`Rfq`, `Quote`, `Negotiation`, `ApprovalRule`, `PurchaseOrder`

## API surface

`postRfq`, `submitQuote`, `acceptQuote`, `approvals`

## Events published

- `b2b.rfq.v1`
- `b2b.quote.v1`

## Business-model notes

Coexists with B2C on one tenant (e.g. retail + bulk pricing for the same product).

## Non-functional requirements and acceptance

- RFQ-to-first-quote median < 24 h (tracked)
- Approval rules evaluated deterministically and audited

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
