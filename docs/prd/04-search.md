# PRD: Search & Discovery

**Phase:** 1 · **Owning team:** Discovery squad

## Purpose

Fast, relevant, multilingual product discovery that respects tenant, region and vertical facets.

## MVP scope

- Index built from catalog/pricing/inventory events
- Full-text with typo tolerance, synonyms, transliteration (e.g. Hinglish)
- Facets from vertical packs
- Autocomplete and query suggestions
- Merchandising rules (pin, boost, bury)
- Postgres FTS default; OpenSearch adapter

## Later scope

- Semantic and vector search
- Visual search (image upload)
- Voice search
- Learning-to-rank
- Sponsored results blending (ads)
- Personalized ranking

## Key entities

`SearchDocument`, `SynonymSet`, `MerchRule`, `QueryLog`

## API surface

`search(query, filters, facets, page)`, `suggest(prefix)`

## Events published

- `search.query.v1 (for analytics and LTR training)`

## Business-model notes

B2B: filter by MOQ, certifications, origin, lead time. Grocery: filter by store or dark-store availability and slot.

## Non-functional requirements and acceptance

- p95 < 120 ms for search, < 40 ms for autocomplete
- Index freshness < 5 s from catalog event
- Zero-result rate < 3%

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
