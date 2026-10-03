# PRD: Admin & Operations Console

**Phase:** 1 · **Owning team:** Platform team

## Purpose

Run every tenant safely: configuration, moderation and operations.

## MVP scope

- Tenant config editor (white-label theme preview, domains, models, packs, adapters)
- Vertical pack manager (create/version packs, zero code)
- Moderation queues (listings, reviews)
- Order/refund overrides with audit
- Role management

## Later scope

- Operational dashboards per region
- Bulk operations
- Compliance reports

## Key entities

`AdminUser`, `AuditLog`, `ModerationItem`

## API surface

Admin BFF over federated graph

## Events published

- (consumes and issues commands)

## Business-model notes

Separate permission scopes for platform operators vs tenant admins.

## Non-functional requirements and acceptance

- Every admin action audited immutably
- Least-privilege defaults

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
