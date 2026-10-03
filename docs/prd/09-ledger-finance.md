# PRD: Ledger & Finance

**Phase:** 1 · **Owning team:** Finance platform squad

## Purpose

Immutable double-entry ledger as the financial source of truth for buyers, sellers, the platform and tax authorities.

## MVP scope

- Double-entry journal (append-only), accounts per tenant/seller/platform
- Commission and fee calculation
- Seller payouts schedule and statements
- Reconciliation: PSP settlements ↔ orders ↔ bank
- Invoices and credit notes (per-country formats)

## Later scope

- E-invoicing integrations (IN, EU, LATAM)
- Tax reporting (GST returns, 1099-K, VAT OSS)
- Revenue recognition
- Seller financing

## Key entities

`Account`, `JournalEntry`, `Payout`, `Invoice`, `Settlement`

## API surface

Internal API + `ledger.*` events; admin reports

## Events published

- `ledger.entry.v1`
- `ledger.payout.v1`

## Business-model notes

Marketplace: commissions, TCS/TDS withholding. B2B: invoices with payment terms. 1P: inventory valuation hooks.

## Non-functional requirements and acceptance

- Ledger always balances (invariant checked continuously)
- Daily reconciliation with < 0.01% unexplained variance

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
