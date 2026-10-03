# ADR-0001: TypeScript everywhere in an Nx + pnpm monorepo

**Status:** Accepted · 2026-10-03

## Context
The platform has ~25 services and ~11 client apps that share value objects (Money, Address, TenantContext), API contracts and a design system. The client wants one hiring profile and fast cross-team changes.

## Decision
- TypeScript for web (Next.js), mobile (React Native/Expo), services (NestJS) and tooling. Python is allowed **only** in `ml/` for model training and serving.
- One monorepo using pnpm workspaces and Nx for affected-only builds, caching and the project graph.
- Shared code lives in `libs/*` and is consumed as built packages (`workspace:*`).

## Consequences
- One PR can change a contract, the service and the UI together. CI runs only the affected projects.
- Node's single-threaded model needs care for CPU-heavy work (pricing simulations, ranking). Those go to worker threads, Temporal workers, or the Python ML tier.
- Engineers need repo-wide conventions: lint rules, the service template and code owners per directory.

## Alternatives considered
- **Java/Spring + React:** mature, but splits the team across two languages and duplicates contracts.
- **Polyrepo:** stronger isolation, but contract drift and slow cross-cutting changes.
