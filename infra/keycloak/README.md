# Identity provider (Keycloak by default)

`lightshop-realm.json` is the **development** realm, imported by `docker compose --profile full up`
(`start-dev --import-realm`). It encodes the platform's IdP-agnostic **claims contract**:

The `lightshop` client scope is self-contained: it emits every claim below itself, so it doesn't depend on
Keycloak's built-in scopes. Since Keycloak 25, `sub` comes from the built-in `basic` scope, which a realm that
defines its own scopes doesn't get.

| Claim (access token) | Source | Used by |
|---|---|---|
| `sub` | user id (`oidc-sub-mapper`) | everything |
| `tenant_id` | user attribute (admin-editable only; `*` for platform operators) | tenant binding of every token |
| `roles` | realm roles: `buyer`, `seller`, `catalog:admin`, `tenant:admin`, `platform:admin` | authorization |
| `seller_id` / `org_id` | user attributes | seller ownership, B2B organizations |
| `aud` contains `lightshop` | audience mapper | API audience check |

Clients: `lightshop-storefront` (confidential, authorization code + PKCE S256, one client for all white-label
domains) and `lightshop-ci` (password grant, **CI/dev only, so delete it in real environments**).

Dev users (password = username): `ana` (acme buyer), `acme-admin`, `gadgetco` (acme seller `sel_gadgetco`),
`raj` (verde buyer, org `org_raj_traders`), `ops` (platform admin).

## Other providers

Any OIDC provider works if it emits the same claims: Ory/Kratos+Hydra (token hook), Zitadel (actions),
Auth0 (post-login action), Entra ID (claims mapping + app roles), Okta (custom authorization server claims).
Services only need `OIDC_ISSUER`, `OIDC_AUDIENCE` and optionally `OIDC_JWKS_URL`. The storefront also needs
`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `SESSION_SECRET`.

## Production

- Replace secrets and redirect URIs (one redirect per custom domain, managed by the tenant registry's onboarding).
- Remove `lightshop-ci` and the dev users; set `sslRequired: all`; enable registration if customers self-register.
- Per-store login branding: Keycloak themes or a realm per tenant. Both work with the same claims contract.
