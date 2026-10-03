# ADR-0002: Cell-based multi-region with data residency

**Status:** Accepted · 2026-10-03

## Context
The platform launches multi-region on day 1 (US, EU, IN, SEA). Regulations (GDPR, India DPDP, and others) require personal and transactional data to stay in region. Flash sales in one market must not degrade others.

## Decision
- Each region is an independent **cell**: a full copy of the domain services, its own databases, event bus and caches. A cell can serve its tenants with every other region down.
- Each tenant has a **home region** (`TenantConfig.regions[0]`) plus optional secondary regions. The edge routes requests by tenant and the customer's account home.
- A thin **global control plane** holds only what must be global: the tenant registry, identity directory (pseudonymous IDs), catalog syndication (non-personal product data), FX rates and feature flags.
- Prices, offers, stock, orders, payments and customer PII are **regional only**.
- Cross-region flows (cross-border orders) are explicit integrations between cells, never shared databases.

## Consequences
- Blast radius is one region. DR works per region (RPO ≤ 5 min, RTO ≤ 30 min).
- Global reporting comes from a lakehouse fed by de-identified regional CDC.
- Running N cells costs more than one global cluster. Small regions can start as a "mini-cell" on shared infrastructure, with logical isolation, and graduate later.

## Alternatives considered
- **Single global cluster with geo-partitioned tables (CockroachDB/Spanner):** simpler topology, but couples regions and invites lock-in. It stays an option for the ledger only.
