# PRD: Analytics & Experimentation

**Phase:** 1–3 · **Owning team:** Data platform team

## Purpose

Trustworthy metrics and experiments for tenants, sellers and the platform.

## MVP scope

- Event collection SDK (web/mobile) → regional lake
- CDC from service databases
- Core dashboards: GMV, conversion funnel, AOV, cohorts
- Seller analytics

## Later scope

- Experimentation platform (A/B, feature flags; GrowthBook/Unleash adapter)
- Feature store for ML
- Self-serve BI per tenant

## Key entities

`Event`, `Metric`, `Experiment`, `Exposure`

## API surface

Query APIs for dashboards; flag evaluation SDK

## Events published

- (consumes all)

## Business-model notes

Metrics definitions per model (e.g. RFQ conversion for B2B).

## Non-functional requirements and acceptance

- Dashboards fresh < 5 min
- PII de-identified before leaving region

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
