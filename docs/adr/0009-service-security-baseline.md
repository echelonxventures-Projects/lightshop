# ADR-0009: Service security baseline

**Status:** Accepted · 2026-10-03

## Context
Phase 0 shipped the catalog with open mutations, a tenant header that any caller could set, demo data on by default, and no query-cost limits. Each of these is exploitable as soon as a service is reachable.

## Decision
Every service built from the [service template](../architecture/service-template.md) applies this baseline:

1. **Identity comes only from verified tokens.** `libs/auth` verifies OIDC access tokens through JWKS from any standards-compliant IdP (Keycloak by default). Claims: `sub`, `tenant_id`, `roles`, and optionally `seller_id` and `org_id`. User and org IDs are **never** read from plain headers.
2. **Authorization happens in the application layer**, not in resolvers, so every entry point (GraphQL, events, seeds, future REST) passes the same checks. A write needs a principal whose `tenant_id` equals the request's tenant and which has a permitted role. Sellers can act only on their own `seller_id`.
3. **Tenant headers are trusted only from the gateway/BFF.** `x-tenant-id` is honoured only when the caller presents `GATEWAY_SHARED_SECRET` (constant-time compare). Everyone else is resolved by Host. Production adds service-mesh mTLS on top. The shared secret is the in-process check that still holds if the mesh is misconfigured.
4. **Invalid tokens fail closed.** A request with a bad bearer token is rejected (`UNAUTHENTICATED`) even for public reads, rather than silently downgraded to anonymous.
5. **Bounded query cost:** a depth limit (default 12, fragments expanded), a parse-time token limit (default 5,000) and page sizes capped at 100. Introspection is off in production.
6. **Secure defaults, fail-fast production.** Demo data is off unless `SEED_DEMO=true`. With `NODE_ENV=production` a service **refuses to boot** without `OIDC_ISSUER`, a ≥ 32-character `GATEWAY_SHARED_SECRET` and a real database, or with demo seeding enabled.
7. **Local development stays zero-dependency.** HS256 dev tokens (`pnpm dev:token`) replace the IdP, and the dev verifier refuses to construct when `NODE_ENV=production`.

## Consequences
- Each rule has a test: `services/catalog/test/catalog.e2e.test.ts` (catalog security suite), `src/config.test.ts`, `src/graphql/limits.test.ts`, `libs/auth/src/auth.test.ts`.
- IdPs must be configured to emit the claims above (Keycloak protocol mappers or the equivalent elsewhere).
- Still to come: Postgres row-level security (Phase 1), per-tenant rate limiting at the gateway, and audit logging of privileged writes.
