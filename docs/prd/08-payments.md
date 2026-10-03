# PRD: Payments

**Phase:** 1 · **Owning team:** Payments squad

## Purpose

Provider-agnostic payment orchestration: route, retry and fail over across PSPs and local methods, with PCI scope minimized.

## MVP scope

- PaymentProvider port ✅; manual provider (COD, bank transfer, invoice) ✅
- Stripe/Adyen/Razorpay/PayPal adapters (first 2–3 per region)
- Routing rules per tenant, method, currency and amount
- 3DS/SCA, tokenization, saved methods via PSP vaults
- Webhooks normalized into payment events
- Refunds (full and partial) to source

## Later scope

- Wallet and stored value
- BNPL and EMI
- B2B net terms with credit limits
- Escrow / trade assurance (release on delivery confirmation)
- Split payments to sellers (marketplace payouts via PSP connect products)

## Key entities

`PaymentIntent`, `PaymentAttempt`, `Refund`, `RoutingRule`, `Wallet`

## API surface

`createPayment`, `capture`, `refund`; webhook ingress per adapter

## Events published

- `payments.payment.v1 (authorized, captured, failed, refunded)`

## Business-model notes

B2C: cards, wallets, local methods, COD. B2B: invoice/net terms, bank transfer, escrow. 1P stores: POS terminals via adapter.

## Non-functional requirements and acceptance

- Authorization success rate tracked per route; automatic failover on PSP outage
- PCI-DSS SAQ-A/A-EP scope
- Exactly-once financial effect via idempotency + ledger reconciliation

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
