# gateway

Public GraphQL edge ([ADR-0010](../../docs/adr/0010-graphql-gateway.md)). Composes the subgraphs in `SUBGRAPHS` into one supergraph (Apollo Federation v2 spec, MIT-licensed Hive Gateway runtime + The Guild composer), and decides everything untrusted before a request reaches a service:

1. **Tenant** from `Host` (custom domains). `x-tenant-id` is accepted only from trusted BFFs that present `GATEWAY_SHARED_SECRET`.
2. **CORS** only from the tenant's own domains.
3. **Rate limit** per (tenant, client IP): `RATE_LIMIT_PER_MINUTE`, with the `RateLimiter` port for a shared Valkey limiter.
4. **Token** verification (`libs/auth`, any OIDC provider). Tokens for another store are rejected (403).
5. **Headers rebuilt from scratch**: client identity headers never pass through. Subgraphs receive `x-tenant-id`, the gateway secret, `authorization`, locale/region/currency and trace context.
6. **Query limits**: depth and token limits shared with subgraphs (`libs/graphql-security`); introspection off in production.

Supergraph composition runs at startup (a broken subgraph fails the deploy) and every `SUPERGRAPH_REFRESH_MS`. A failed refresh keeps serving the last good composition.

```bash
pnpm dev:catalog
pnpm dev:gateway        # :4000 → http://acme.localhost:4000/graphql
```
