# Service Template

`services/catalog` is the reference implementation. Every new service copies its shape.

```
services/<name>/
  src/
    domain/            # Aggregates and value objects. Pure TS, no framework imports.
    application/       # Use cases; take RequestContext explicitly; throw typed errors with stable codes
    infrastructure/    # Repository port + Postgres and in-memory adapters, outbox relay
    graphql/           # Resolvers (schema-first from libs/contracts), context builder, error filter
    <name>.module.ts   # Wiring: adapters picked by config, DI via explicit @Inject(token)
    config.ts          # Env → typed config; sensible zero-dependency defaults
    main.ts
  test/<name>.e2e.test.ts   # Boots the module in memory mode; exercises the GraphQL contract
```

## Checklist for a new service

1. Add the SDL to `libs/contracts/schema/<name>.graphql` and the event types/topics to `libs/contracts/src/events.ts`.
2. Model the aggregate in `domain/` with unit tests for its invariants.
3. Write a repository port. Its `save(aggregate, events)` must be atomic: use `appendToOutbox` / `PostgresOutbox` / `InMemoryOutbox` and `OutboxRelay` from `libs/outbox`.
4. Provide **both** an in-memory and a Postgres adapter, so `pnpm dev` and tests need no Docker.
5. Resolve tenancy only through `RequestContext`. Every query is tenant-scoped.
6. Pick infrastructure through ports from `libs/adapters`. Never import a vendor SDK.
7. Map application errors to stable GraphQL `extensions.code` values.
8. Apply the [security baseline](../adr/0009-service-security-baseline.md): authorize in the application layer, trust tenant headers only from the gateway, keep query limits, and fail fast on an unsafe production config.
9. Expose `/health` (include outbox depth). Import a `telemetry.ts` first in `main.ts` (`startTelemetry` from `libs/observability`), use `JsonLogger`, and add `integration('TEST_DATABASE_URL')`-gated repository tests using `libs/testing`.
10. Add the service to the gateway composition, Helm values and CI.

## Why explicit `@Inject(token)`

Constructor parameters use explicit tokens, so the code doesn't depend on `emitDecoratorMetadata`. That lets Vitest/esbuild and `tsx` run services directly, and keeps DI visible in code review.
