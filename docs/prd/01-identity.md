# PRD: Identity & Accounts

**Phase:** 0 · **Owning team:** Platform team

## Purpose

Single identity layer for every actor (customer, seller staff, B2B buyer and approver, store associate, rider, admin) across all tenants, with OIDC as the only integration contract.

## MVP scope

- Customers sign up and sign in with email/phone OTP, passkeys and social login (per-tenant toggles)
- Org model: Organization → members with roles (owner, buyer, approver, finance, viewer)
- RBAC + ABAC policy evaluation (tenant, org, region, resource ownership)
- Consent ledger (marketing, cookies, data processing) per regulation: GDPR, CCPA, DPDP
- Session and device management; step-up auth for sensitive actions
- Admin impersonation with audit trail

## Later scope

- B2B SSO (SAML/OIDC federation per buyer org)
- KYC/KYB via adapter (document + liveness, business registry checks)
- Verified Supplier badges
- Risk-based authentication signals to the risk context

## Key entities

`User`, `Organization`, `Membership`, `Role`, `Policy`, `Consent`, `Device`, `KycCase`

## API surface

`me`, `organization`, `inviteMember`, `updateConsent`; OIDC endpoints via Keycloak (default adapter)

## Events published

- `identity.user.v1 (created, verified, deleted)`
- `identity.org.v1 (created, member-added, kyb-status-changed)`

## Business-model notes

B2C: individual accounts. B2B: orgs with approvals and spend limits. 1P: store staff identities. D2C: guest checkout plus optional account.

## Non-functional requirements and acceptance

- p95 token validation < 5 ms at the edge (JWKS cached)
- Right-to-erasure completed across contexts within 30 days via `identity.user.v1 deleted`
- No PII leaves the user's home region

## Cross-cutting requirements (all contexts)

- Tenant-scoped data and APIs; white-label (no hard-coded branding or copy)
- External dependencies only through `libs/adapters` ports
- Localized (ICU messages), multi-currency via `Money`, region-resident data
- OpenTelemetry traces, structured logs, `/health`; audit log for privileged actions
