# PRD: Customer Service

**Phase:** 1–2 · **Owning team:** CX squad

## Purpose

Resolve issues fast with full order context, mostly self-serve.

## MVP scope

- Help center per tenant (CMS)
- Order-aware self-service (cancel, return, track)
- Ticketing with SLAs
- Agent desk with customer 360

## Later scope

- Chatbot → agent handoff
- A-to-Z style guarantee claims
- Buyer–seller–platform dispute resolution
- Voice/IVR integration via adapter

## Key entities

`Ticket`, `Claim`, `Dispute`, `Macro`

## API surface

`tickets`, `openTicket`, `fileClaim`

## Events published

- `support.ticket.v1`
- `support.claim.v1`

## Business-model notes

B2B: account managers and escalation paths.

## Non-functional requirements and acceptance

- > 60% contacts resolved via self-service
- First response SLA per tenant config

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
