# ADR-0010: GraphQL gateway on MIT-licensed federation components

**Status:** Accepted · 2026-10-04

## Context
The public API is a federated graph (ADR-0001). Common gateways: Apollo Router and Apollo Gateway (Elastic License v2, which restricts offering the software as a managed service), WunderGraph Cosmo Router (Apache-2.0, Go), and Hive Gateway (MIT, Node.js). The platform must be resellable and self-hostable with zero vendor lock-in (ADR-0006).

## Decision
- **Hive Gateway runtime** (`@graphql-hive/gateway-runtime`, MIT) executes the supergraph, and **`@theguild/federation-composition`** (MIT) composes it from each subgraph's `_service { sdl }`. Subgraphs stay plain Apollo Federation v2, so switching to Cosmo or Apollo Router later needs no service changes.
- A thin **edge layer** we own (`services/gateway/src/edge.ts`) handles tenant resolution, CORS, rate limiting, token verification and header sanitization before the runtime. These are platform rules, so they stay out of vendor plugins.
- Composition runs at startup (fail fast) and on an interval, keeping the last good supergraph when a refresh fails.

## Consequences
- No license restricts the white-label SaaS business model.
- A Node gateway's throughput per core is lower than Rust/Go routers. It scales horizontally; if needed, Cosmo Router can replace the runtime while keeping the edge rules (as a sidecar or ported).
- Header propagation is explicit (an allow-list), so new cross-cutting headers must be added deliberately.
