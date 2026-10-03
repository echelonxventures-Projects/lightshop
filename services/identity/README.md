# identity

**Phase 0 (done):** authentication runs through any standards-compliant OIDC provider, with no custom identity code in the request path.

- **IdP setup as code:** [`infra/keycloak`](../../infra/keycloak/README.md). It defines the claims contract (`tenant_id`, `roles`, `seller_id`, `org_id`, `aud`), realm roles, the storefront client (code + PKCE) and dev users.
- **Token verification:** `libs/auth` (JWKS, any provider). Used by the gateway and every service.
- **Login flow:** the storefront's `/auth/login` → `/auth/callback` → `/auth/logout` (standard OIDC with PKCE, encrypted httpOnly session, bound to one store).
- **Verified in CI:** the `identity` job boots Keycloak with the realm and checks its tokens against `libs/auth`. Storefront sign-in is covered by Playwright against a protocol-level mock provider.

**Phase 1 (this service):** the identity subgraph `me`, B2B organizations and memberships, invitations, approval roles, consent ledger and KYC/KYB orchestration (adapters). See the [PRD](../../docs/prd/01-identity.md).
