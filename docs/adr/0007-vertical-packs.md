# ADR-0007: Industries as Vertical Packs (data, not code)

**Status:** Accepted · 2026-10-03

## Context
The platform must cover every industry: electronics, fashion, grocery, pharmacy, industrial B2B, automotive fitment, jewelry, food delivery, services and more. Industry-specific code paths would multiply without bound.

## Decision
A **Vertical Pack** (`libs/vertical-packs`) is versioned data:
- `attributes`: a JSON Schema for product attributes (validated with Ajv, with defaults applied)
- `facets` and `variantAxes`: drive search filters and variant pickers
- `compliance`: seller licenses, restricted regions, required documents, prescription checks
- `fulfillment`: cold chain, bulky, batch/expiry, serial capture, delivery slots, freight quotes
- `returns`: returnability, window, inspection, exchange

Packs register at runtime (`VerticalPackRegistry.register`), so the admin console or a tenant can add a private pack with no deploy. Versions only move forward. Seller listing forms render from `attributeSchema`.

Six packs ship in Phase 0: general, electronics, fashion, grocery, industrial, pharmacy. The [roadmap](../roadmap.md) adds the rest.

## Consequences
- Core services stay industry-agnostic. Behaviour switches on pack *capabilities* (`fulfillment.coldChain`), never on pack *IDs*.
- Some verticals need real code (automotive fitment lookups, pharmacy prescription review). These are built as capability modules that packs switch on.
