# PRD: Customer Engagement: Reviews, Notifications, Live & Social

**Phase:** 1–3 · **Owning team:** Engagement squad

## Purpose

Trust signals and conversations that bring customers back.

## MVP scope

- Ratings and reviews (verified purchase), media, Q&A
- Moderation queue (rules + ML/LLM assist)
- Notifications service: email, SMS, push, WhatsApp, in-app via adapters; per-tenant templates; preference center

## Later scope

- Live commerce and shoppable video
- Group buying
- Influencer storefronts
- AI shopping assistant (Claude via adapter): Q&A, comparisons, order help

## Key entities

`Review`, `Question`, `Answer`, `NotificationTemplate`, `Preference`, `Delivery`

## API surface

`reviews`, `submitReview`, `askQuestion`; internal `notify` API

## Events published

- `reviews.review.v1`

## Business-model notes

B2B: supplier ratings and transaction history instead of consumer reviews.

## Non-functional requirements and acceptance

- Review fraud detection with risk context
- Notification delivery tracked end-to-end; quiet hours per locale

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
