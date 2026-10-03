# Roadmap & Estimation

Durations assume the team ramps up as shown. Estimates are in **engineer-months (EM)**, exclude design/PM/QA leadership (add ~25%), and carry ±30% uncertainty until each PRD is refined in discovery.

## Phases

| Phase | Window | Outcome | Exit criteria |
|---|---|---|---|
| **0 — Foundation** | M0–M3 | Monorepo, platform libs, reference service, white-label storefront skeleton, CI/CD, IaC, 2 regional cells, observability, identity + tenant registry | A new store launches from config alone in staging. The catalog service is in production behind the gateway. |
| **1 — MVP marketplace (B2C + D2C)** | M3–M9 | Discover → buy → fulfil → return → pay out sellers, in 2 regions, with 5 vertical packs, web + mobile apps | First 3 tenants live. Checkout at 99.99% in a load test at 10× expected peak. |
| **2 — B2B + Omnichannel** | M9–M15 | RFQ/quotes, buyer orgs and approvals, net terms, trade assurance; stores, POS, BOPIS, ship-from-store, DOM, WMS, own last mile, grocery slots | One B2B tenant and one omnichannel retailer live. 4 regions. |
| **3 — Growth & Intelligence** | M15–M24 | Retail media, recommendations + LTR, AI assistant, dynamic pricing, loyalty/membership, live commerce, fraud ML, forecasting, quick commerce, cross-border | Ads revenue live. Recs drive ≥ 15% of GMV. Fraud loss < target bps. |
| **4 — Ecosystem** | M24+ | All vertical packs, self-serve SaaS onboarding, partner app marketplace, fintech (BNPL, seller loans), logistics-as-a-service | Self-serve tenants onboard with no human involvement. |

## Phase 0 status

| Item | Status | Where |
|---|---|---|
| Monorepo, tooling, CI, repo hygiene (LICENSE, SECURITY, CODEOWNERS, Renovate) | ✅ | root, `.github/` |
| Shared libs: domain-kernel, tenancy (live registry), adapters, vertical-packs, contracts, ui, auth, observability, testing, outbox, api-sdk, graphql-security | ✅ | `libs/` |
| Catalog reference service (auth, tenant trust, outbox, metrics) | ✅ | `services/catalog` |
| Tenant registry + zero-code launch workflow (Temporal) | ✅ | `services/tenant-registry` |
| GraphQL gateway (MIT federation, edge security) | ✅ | `services/gateway` |
| Identity: OIDC sign-in, claims contract, Keycloak realm as code | ✅ | `apps/web-storefront/app/auth`, `infra/keycloak` |
| White-label storefront (multi-tenant by Host, themes, sign-in) | ✅ | `apps/web-storefront` |
| Observability (OTel traces/metrics, JSON logs, Grafana dashboard) | ✅ | `libs/observability`, `infra/observability` |
| Integration tests on real Postgres, Kafka, Keycloak, Temporal (test server) | ✅ | CI jobs `integration`, `identity`, service tests |
| Infra: Terraform cells for AWS/GCP/Azure/on-prem, Helm, ArgoCD, images, deploy workflow | ✅ deployment-ready | `infra/`, [deployment runbook](runbooks/deployment.md) |
| **Staging running in 2 cells** (exit criterion) | ⏳ needs client inputs | cloud account(s), cell regions, DNS domains, production IdP realm, secrets backend; then follow the runbook |

## Team topology (~60–70 engineers during Phases 1–3, plus ~25% design, PM and QA)

| Group | Squads | Contexts owned |
|---|---|---|
| Platform | Platform infra/SRE, Developer experience, Identity & tenancy | infra, CI/CD, observability, identity, tenant registry, admin console |
| Buyer experience | Web, Mobile, Discovery, Checkout, Engagement | storefront, apps, search, cart/checkout, reviews, notifications, CMS |
| Marketplace | Catalog, Seller, B2B, Pricing & promotions | catalog, seller platform, RFQ, pricing, promotions |
| Money | Payments, Finance platform, Risk | payments, ledger, payouts, risk |
| Supply chain | Fulfillment, Inventory/WMS, Logistics, Stores | orders, inventory, WMS, logistics, returns, omnichannel |
| Data & AI | Data platform, ML (recs/ranking/fraud/forecast), Ads | analytics, experimentation, ML services, retail media |

Each squad has 5–8 engineers and owns its services end to end, including on-call.

## Estimation sheet (engineer-months)

| Context | P0 | P1 | P2 | P3 | Notes |
|---|---:|---:|---:|---:|---|
| Platform infra, CI/CD, IaC, observability, cells | 24 | 30 | 24 | 24 | Grows with regions |
| Identity & accounts | 6 | 12 | 8 | 4 | SSO/KYB in P2 |
| Tenant registry + admin console | 4 | 14 | 8 | 8 | Self-serve SaaS in P4 |
| Catalog & PIM | 4 ✅ | 18 | 8 | 10 | AI listing in P3 |
| Search & discovery | — | 18 | 10 | 24 | Semantic/visual/LTR in P3 |
| Pricing | — | 8 | 10 | 10 | Dynamic pricing P3 |
| Promotions & loyalty | — | 10 | 6 | 16 | Membership P3 |
| Cart & checkout | — | 20 | 12 | 6 | B2B checkout P2 |
| Payments | 2 ✅ | 22 | 14 | 12 | Per-region PSP adapters |
| Ledger & finance | — | 18 | 12 | 10 | E-invoicing per country |
| Orders / DOM | — | 16 | 14 | 6 | DOM sourcing P2 |
| Inventory & WMS | — | 12 | 30 | 10 | WMS + handheld P2 |
| Logistics & last mile | — | 12 | 30 | 18 | Rider app P2, quick commerce P3 |
| Returns | — | 8 | 6 | 4 | |
| Seller platform | — | 20 | 10 | 10 | |
| B2B wholesale | — | — | 30 | 12 | |
| Omnichannel & POS | — | — | 30 | 10 | |
| Advertising | — | — | — | 30 | |
| Engagement (reviews, notifications, live, AI) | — | 14 | 8 | 24 | |
| Customer service | — | 8 | 8 | 6 | |
| Trust, safety & risk | — | 8 | 10 | 18 | |
| CMS | — | 6 | 4 | 4 | |
| Analytics & experimentation + ML platform | 2 | 14 | 16 | 30 | |
| Web storefront | 2 ✅ | 20 | 10 | 10 | |
| Mobile apps (customer, seller, rider, warehouse, POS) | — | 24 | 36 | 16 | |
| Design system & UX | 3 ✅ | 10 | 6 | 6 | |
| Vertical packs (content + capability modules) | 1 ✅ | 6 | 10 | 14 | |
| Security & compliance (PCI, SOC 2, DPDP/GDPR) | 2 | 10 | 8 | 8 | Plus external audits |
| **Total** | **~50** | **~358** | **~378** | **~360** | **≈ 1,150 EM through Phase 3** |

✅ = scaffolded in this repository at Phase 0 start.

## Key risks

| Risk | Mitigation |
|---|---|
| Scope breadth dilutes the MVP | Phase gates. Phase 1 is B2C + D2C only, with 5 packs and 2 regions. |
| Payments and compliance differ per country | Adapter-first. Launch regions are chosen for PSP and tax readiness. External compliance counsel per region. |
| Data residency mistakes | Cell architecture, residency tests in CI, privacy reviews per PRD |
| Flash-sale overload | Waiting room, inventory tokens, quarterly load tests at 10× peak |
| Adapter abstractions leak | Contract tests per port. At least two real adapters before a port is called stable. |
| Talent ramp | One stack (TypeScript), service template, docs-as-code, inner-source reviews |
