# PRD: Content & CMS

**Phase:** 1 · **Owning team:** Web squad

## Purpose

Let each tenant's merchandisers build pages, banners and campaigns without engineers.

## MVP scope

- Pages composed of typed blocks (hero, product carousel, category grid, banner)
- Scheduling and per-locale content
- Preview per tenant theme

## Later scope

- A/B testing of layouts
- Personalized blocks
- Event microsites

## Key entities

`Page`, `Block`, `Schedule`

## API surface

`page(slug)`; admin editor

## Events published

- `cms.page.v1 (published)`

## Business-model notes

Same blocks across models; B2B adds catalog/price-list-aware blocks.

## Non-functional requirements and acceptance

- Page render from cache < 100 ms TTFB at the edge

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
