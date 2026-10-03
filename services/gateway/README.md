# GraphQL Federation gateway (planned, Phase 0)

Composes the subgraphs (`libs/contracts/schema/*.graphql`) into one supergraph. It passes through or derives `x-tenant-id` from the Host header and enforces auth, rate limits and query cost limits. Apollo Router (Elastic License) or the open-source Hive Gateway (MIT) / Cosmo Router (Apache-2.0), chosen per [ADR-0006](../../docs/adr/0006-zero-vendor-lock-in.md).
