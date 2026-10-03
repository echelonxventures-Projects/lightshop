# ADR-0008: Dependency version policy

**Status:** Accepted · 2026-10-03

## Context
At scaffold time (October 2026) several core tools had brand-new majors: TypeScript 7 (native compiler), Vitest 5, Next.js 16, NestJS 12, GraphQL-js 17, ESLint 10, Nx 23.

## Decision
Pin to the **latest stable minor of the previous major** for the foundation: TypeScript 5.9, Vitest 3, Next.js 15.5, NestJS 11, @nestjs/graphql 13, GraphQL-js 16, ESLint 9, Nx 21, Storybook 9. Upgrade one major at a time in dedicated PRs once each has a few months of ecosystem adoption (Nest/Apollo plugin compatibility, Next.js + React Compiler stability).

## Consequences
- Fewer ecosystem incompatibilities while the foundation stabilizes.
- A quarterly "dependency day" is on the roadmap. Renovate opens the grouped upgrade PRs and CI must pass before merge.
