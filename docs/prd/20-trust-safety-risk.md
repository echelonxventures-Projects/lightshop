# PRD: Trust, Safety & Risk

**Phase:** 1–3 · **Owning team:** Risk squad

## Purpose

Protect buyers, sellers and the platform from fraud, abuse, counterfeits and prohibited items.

## MVP scope

- Rules engine for checkout risk (velocity, geo mismatch, device)
- Restricted products per region (from pack compliance)
- Seller verification gates
- Takedown workflow (IP complaints)

## Later scope

- ML fraud scoring (payments, promo abuse, ATO)
- Brand registry and counterfeit detection
- Review fraud detection
- Seller risk scoring

## Key entities

`RiskDecision`, `Rule`, `Case`, `Takedown`

## API surface

Internal `assess(context)` API

## Events published

- `risk.decision.v1`

## Business-model notes

B2B: KYB depth and trade assurance eligibility.

## Non-functional requirements and acceptance

- Risk decision p95 < 50 ms in checkout path
- Every automated block is explainable and appealable

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
